import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  ASPECT_RATIOS,
  IMAGE_GEN_NOT_CONFIGURED,
  generateImages,
  resolveProvider,
  type ImageProvider,
} from "@/lib/image-gen";
import { brandContext } from "@/lib/brand-context";
import { photoPath, cleanFolder } from "@/lib/photos";

// Generation can take most of a minute; keep under Vercel's ceiling.
export const maxDuration = 60;

const PROVIDER_LABELS: Record<ImageProvider, string> = {
  engine: "HB engine",
  openai: "OpenAI",
  google: "Google Imagen",
  replicate: "Replicate",
  "adobe-firefly": "Adobe Firefly",
};

// AI image generation into the photo library — OUR app, pluggable providers.
// POST { prompt, folder?, aspectRatio?, numVariations?, provider? }
// Generates through lib/image-gen (engine preferred, Adobe Firefly optional),
// downloads the finished images, and saves them into the library folder
// (default "Firefly"). Returns the saved photo URLs and which provider ran.
// Auth via /api/admin middleware. Inert until a provider's env vars are set.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const provider = resolveProvider(typeof body.provider === "string" ? body.provider : undefined);
    if (!provider) {
      return NextResponse.json({ error: IMAGE_GEN_NOT_CONFIGURED }, { status: 503 });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json({ error: "Give a prompt (up to 1,000 characters)." }, { status: 400 });
    }
    const folder = cleanFolder(body.folder) || "Firefly";
    const aspectRatio =
      typeof body.aspectRatio === "string" && (ASPECT_RATIOS as readonly string[]).includes(body.aspectRatio)
        ? body.aspectRatio
        : "1:1";
    const numVariations = Math.min(Math.max(Number(body.numVariations) || 1, 1), 4);

    // Brand context rides inside the prompt so generated assets come out on-brand.
    const brand = await brandContext();
    const fullPrompt = brand ? `${prompt}. ${brand}` : prompt;

    const { jobId, images } = await generateImages({
      prompt: fullPrompt,
      aspectRatio,
      numVariations,
      provider,
    });
    if (!images.length) {
      return NextResponse.json(
        { error: `${PROVIDER_LABELS[provider]} finished but returned no images.` },
        { status: 502 },
      );
    }

    // Persist each image to the photo library; provider CDN links expire.
    // Synchronous providers (Google) hand back base64 bytes instead of a URL.
    const saved = await Promise.all(
      images.map(async (img, i) => {
        let contentType = img.contentType || "image/jpeg";
        let data: ArrayBuffer | Buffer;
        if (img.data) {
          data = Buffer.from(img.data, "base64");
        } else {
          const res = await fetch(img.url);
          if (!res.ok) return null;
          contentType = res.headers.get("content-type") || contentType;
          data = await res.arrayBuffer();
        }
        const ext = contentType.split("/")[1]?.split(";")[0]?.toLowerCase() === "png" ? "png" : "jpg";
        const blob = await put(photoPath(folder, `generated-${jobId || Date.now()}-${i}.${ext}`), data, {
          access: "public",
          addRandomSuffix: true,
          contentType,
        });
        return { url: blob.url, seed: img.seed };
      }),
    );

    const photos = saved.filter(Boolean);
    if (!photos.length) {
      return NextResponse.json(
        { error: "Images generated but could not be saved to the library." },
        { status: 502 },
      );
    }
    return NextResponse.json({ folder, provider, providerLabel: PROVIDER_LABELS[provider], photos });
  } catch (error: any) {
    console.error("image generate failed", error);
    // Provider bodies can carry internals — surface only the short reason, log the rest.
    const msg = String(error?.message || "Generation failed.").split("\n")[0].slice(0, 200);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
