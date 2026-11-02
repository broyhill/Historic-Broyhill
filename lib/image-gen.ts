// Our authored image-generation surface. The photo library's "Generate with AI"
// panel talks to THIS — never to a vendor. Providers are swappable adapters:
//
//   "adobe-firefly"  Adobe Firefly v4 (lib/firefly.ts) — ADOBE_FIREFLY_CLIENT_ID/SECRET
//   "google"         Google Imagen via Gemini API (lib/google-image.ts) —
//                    IMAGE_GEN_GOOGLE_KEY, optional IMAGE_GEN_GOOGLE_MODEL.
//                    Synchronous: returns base64 bytes, no polling.
//   "openai"         OpenAI Images API (lib/openai-image.ts) — uses the
//                    OPENAI_API_KEY already on the project; gpt-image-1-mini
//                    (~$0.005/image). Synchronous b64_json, no polling.
//   "replicate"      Replicate prediction API (lib/replicate.ts) —
//                    IMAGE_GEN_REPLICATE_TOKEN, optional IMAGE_GEN_REPLICATE_MODEL
//                    (default black-forest-labs/flux-schnell, ~$0.003/image).
//                    Async: polls the prediction's urls.get like Firefly.
//   "engine"         Our own generation engine (e.g. the XSELLNET render lane or a
//                    self-hosted model) — IMAGE_GEN_ENGINE_URL, optional
//                    IMAGE_GEN_ENGINE_TOKEN. The engine answers the same async
//                    envelope: POST {url}/v1/images/generate → either
//                    { images: [{url, seed}], jobId } synchronously, or
//                    { statusUrl, jobId } polled until { status: "succeeded",
//                    result: { outputs: [{url|image.url, seed}] } }.
//
// Selection: IMAGE_GEN_PROVIDER pins one provider; unset ("auto") prefers
// our engine, then OpenAI, Google, Replicate, then Adobe.

import { pollAsyncJob, type AsyncJobOutcome } from "@/lib/async-job";
import { fireflyEnabled, generateWithFirefly } from "@/lib/firefly";
import { googleEnabled, generateWithGoogle } from "@/lib/google-image";
import { replicateEnabled, generateWithReplicate } from "@/lib/replicate";
import { openaiEnabled, generateWithOpenAI, editWithOpenAI } from "@/lib/openai-image";

export const ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export type ImageProvider = "engine" | "openai" | "google" | "replicate" | "adobe-firefly";

export interface GeneratedImage {
  seed: number;
  url: string;
  data?: string;
  contentType?: string;
}

export interface GenerateResult {
  jobId: string;
  provider: ImageProvider;
  images: GeneratedImage[];
}

export const IMAGE_GEN_NOT_CONFIGURED =
  "Image generation is not configured (set IMAGE_GEN_ENGINE_URL for the HB engine, OPENAI_API_KEY for OpenAI, IMAGE_GEN_GOOGLE_KEY for Google Imagen, IMAGE_GEN_REPLICATE_TOKEN for Replicate, or ADOBE_FIREFLY_CLIENT_ID + ADOBE_FIREFLY_CLIENT_SECRET for the Adobe provider).";

export const engineEnabled = () => Boolean(process.env.IMAGE_GEN_ENGINE_URL);

export function configuredProviders(): ImageProvider[] {
  const out: ImageProvider[] = [];
  if (engineEnabled()) out.push("engine");
  if (openaiEnabled()) out.push("openai");
  if (googleEnabled()) out.push("google");
  if (replicateEnabled()) out.push("replicate");
  if (fireflyEnabled()) out.push("adobe-firefly");
  return out;
}

export function resolveProvider(requested?: string): ImageProvider | null {
  const available = configuredProviders();
  if (!available.length) return null;
  const pin = (requested || process.env.IMAGE_GEN_PROVIDER || "auto") as ImageProvider | "auto";
  if (pin !== "auto") return available.includes(pin) ? pin : null;
  return available[0]; // engine first when both exist
}

async function generateWithEngine(opts: {
  prompt: string;
  aspectRatio: AspectRatio;
  numVariations: number;
}): Promise<AsyncJobOutcome> {
  const base = process.env.IMAGE_GEN_ENGINE_URL!.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.IMAGE_GEN_ENGINE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.IMAGE_GEN_ENGINE_TOKEN}`;
  }

  const res = await fetch(`${base}/v1/images/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: opts.prompt,
      aspectRatio: opts.aspectRatio,
      numVariations: opts.numVariations,
    }),
  });
  if (!res.ok) throw new Error(`Engine rejected the request (${res.status}).`);
  const body = await res.json();

  if (body.statusUrl) {
    return pollAsyncJob(body.statusUrl, headers, { label: "Engine" });
  }
  const outputs = body.images ?? body.result?.outputs ?? [];
  return {
    jobId: body.jobId ?? "",
    images: outputs
      .map((o: any) => ({ seed: o.seed ?? 0, url: o.image?.url ?? o.url }))
      .filter((o: GeneratedImage) => Boolean(o.url)),
  };
}

export async function generateImages(opts: {
  prompt: string;
  aspectRatio?: string;
  numVariations?: number;
  provider?: string;
}): Promise<GenerateResult> {
  const primary = resolveProvider(opts.provider);
  if (!primary) throw new Error(IMAGE_GEN_NOT_CONFIGURED);

  const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(opts.aspectRatio ?? "")
    ? (opts.aspectRatio as AspectRatio)
    : "1:1";
  const numVariations = Math.min(Math.max(opts.numVariations ?? 1, 1), 4);

  // Backup chain: the resolved provider first, then every other configured
  // provider — a vendor outage falls through to the next adapter, not a 500.
  const chain = [primary, ...configuredProviders().filter((p) => p !== primary)];
  let lastError: unknown = new Error("No provider succeeded.");
  for (const provider of chain) {
    try {
      const outcome =
        provider === "engine"
          ? await generateWithEngine({ prompt: opts.prompt, aspectRatio, numVariations })
          : provider === "openai"
            ? await generateWithOpenAI({ prompt: opts.prompt, aspectRatio, numVariations })
            : provider === "google"
              ? await generateWithGoogle({ prompt: opts.prompt, aspectRatio, numVariations })
              : provider === "replicate"
                ? await generateWithReplicate({ prompt: opts.prompt, aspectRatio, numVariations })
                : await generateWithFirefly({ prompt: opts.prompt, aspectRatio, numVariations });
      return { jobId: outcome.jobId, provider, images: outcome.images };
    } catch (error) {
      console.error(`image-gen provider ${provider} failed, trying next`, error);
      lastError = error;
    }
  }
  throw lastError;
}

// Edit path — rewrite an existing photo from a prompt (fill empty chairs, add
// a speaker). Only the OpenAI adapter supports edits today; the source image
// arrives as bytes either fetched from a blob URL or sent as base64.
export interface SourceImage {
  data: Uint8Array;
  name: string;
  contentType: string;
}

export async function resolveSourceImage(opts: {
  url?: string;
  data?: string; // base64
  contentType?: string;
  name?: string;
}): Promise<SourceImage | null> {
  if (opts.url) {
    if (!/^https:\/\//i.test(opts.url)) throw new Error("Source photo must be an https URL.");
    const res = await fetch(opts.url);
    if (!res.ok) throw new Error("Could not read the source photo.");
    const contentType = res.headers.get("content-type")?.split(";")[0] || "image/png";
    if (!contentType.startsWith("image/")) throw new Error("Source photo is not an image.");
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.byteLength > 25 * 1024 * 1024) throw new Error("Source photo is too large (max 25 MB).");
    return { data, name: opts.name || "source.png", contentType };
  }
  if (opts.data) {
    return {
      data: new Uint8Array(Buffer.from(opts.data, "base64")),
      name: opts.name || "source.png",
      contentType: opts.contentType || "image/png",
    };
  }
  return null;
}

export async function editImage(opts: {
  prompt: string;
  source: SourceImage;
  aspectRatio?: string;
  numVariations?: number;
}): Promise<GenerateResult> {
  if (!openaiEnabled()) throw new Error("Photo editing needs OPENAI_API_KEY (the only edit-capable provider today).");
  const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(opts.aspectRatio ?? "")
    ? (opts.aspectRatio as AspectRatio)
    : "1:1";
  const numVariations = Math.min(Math.max(opts.numVariations ?? 1, 1), 4);
  const outcome = await editWithOpenAI({
    prompt: opts.prompt,
    image: opts.source,
    aspectRatio,
    numVariations,
  });
  return { jobId: outcome.jobId, provider: "openai", images: outcome.images };
}
