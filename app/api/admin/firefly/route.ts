import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { fireflyEnabled, FIREFLY_NOT_CONFIGURED, FIREFLY_SIZES, generateImages } from "@/lib/firefly";
import { photoPath, cleanFolder } from "@/lib/photos";

// Firefly can take most of a minute; keep under Vercel's ceiling.
export const maxDuration = 60;

// AI image generation into the photo library.
// POST { prompt, folder?, aspectRatio?, numVariations? }
// Generates via Adobe Firefly, downloads the finished images, and saves them
// into the library folder (default "Firefly"). Returns the saved photo URLs.
// Auth via /api/admin middleware. Feature is inert until ADOBE_FIREFLY_* envs are set.
export async function POST(request: Request) {
  try {
    if (!fireflyEnabled()) {
      return NextResponse.json({ error: FIREFLY_NOT_CONFIGURED }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json({ error: "Give a prompt (up to 1,000 characters)." }, { status: 400 });
    }
    const folder = cleanFolder(body.folder) || "Firefly";
    const aspectRatio = typeof body.aspectRatio === "string" && body.aspectRatio in FIREFLY_SIZES
      ? (body.aspectRatio as keyof typeof FIREFLY_SIZES)
      : "1:1";
    const numVariations = Math.min(Math.max(Number(body.numVariations) || 1, 1), 4);

    const { jobId, images } = await generateImages({ prompt, aspectRatio, numVariations });
    if (!images.length) {
      return NextResponse.json({ error: "Adobe finished but returned no images." }, { status: 502 });
    }

    // Download each CDN URL and persist it to the photo library; Firefly links expire.
    const saved = await Promise.all(images.map(async (img, i) => {
      const res = await fetch(img.url);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      const blob = await put(
        photoPath(folder, `firefly-${jobId}-${i}.jpg`),
        data,
        { access: "public", addRandomSuffix: true, contentType: res.headers.get("content-type") || "image/jpeg" }
      );
      return { url: blob.url, seed: img.seed };
    }));

    const photos = saved.filter(Boolean);
    if (!photos.length) {
      return NextResponse.json({ error: "Images generated but could not be saved to the library." }, { status: 502 });
    }
    return NextResponse.json({ folder, photos });
  } catch (error: any) {
    console.error("firefly generate failed", error);
    return NextResponse.json({ error: error?.message || "Generation failed." }, { status: 500 });
  }
}
