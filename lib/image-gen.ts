// Our authored image-generation surface. The photo library's "Generate with AI"
// panel talks to THIS — never to a vendor. Providers are swappable adapters:
//
//   "adobe-firefly"  Adobe Firefly v4 (lib/firefly.ts) — ADOBE_FIREFLY_CLIENT_ID/SECRET
//   "engine"         Our own generation engine (e.g. the XSELLNET render lane or a
//                    self-hosted model) — IMAGE_GEN_ENGINE_URL, optional
//                    IMAGE_GEN_ENGINE_TOKEN. The engine answers the same async
//                    envelope: POST {url}/v1/images/generate → either
//                    { images: [{url, seed}], jobId } synchronously, or
//                    { statusUrl, jobId } polled until { status: "succeeded",
//                    result: { outputs: [{url|image.url, seed}] } }.
//
// Selection: IMAGE_GEN_PROVIDER = "engine" | "adobe-firefly" pins one;
// unset ("auto") prefers our engine and falls back to Adobe.

import { pollAsyncJob, type AsyncJobOutcome } from "@/lib/async-job";
import { fireflyEnabled, generateWithFirefly } from "@/lib/firefly";

export const ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export type ImageProvider = "engine" | "adobe-firefly";

export interface GeneratedImage {
  seed: number;
  url: string;
}

export interface GenerateResult {
  jobId: string;
  provider: ImageProvider;
  images: GeneratedImage[];
}

export const IMAGE_GEN_NOT_CONFIGURED =
  "Image generation is not configured (set IMAGE_GEN_ENGINE_URL for the HB engine, or ADOBE_FIREFLY_CLIENT_ID + ADOBE_FIREFLY_CLIENT_SECRET for the Adobe provider).";

export const engineEnabled = () => Boolean(process.env.IMAGE_GEN_ENGINE_URL);

export function configuredProviders(): ImageProvider[] {
  const out: ImageProvider[] = [];
  if (engineEnabled()) out.push("engine");
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
  const provider = resolveProvider(opts.provider);
  if (!provider) throw new Error(IMAGE_GEN_NOT_CONFIGURED);

  const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(opts.aspectRatio ?? "")
    ? (opts.aspectRatio as AspectRatio)
    : "1:1";
  const numVariations = Math.min(Math.max(opts.numVariations ?? 1, 1), 4);

  const outcome =
    provider === "engine"
      ? await generateWithEngine({ prompt: opts.prompt, aspectRatio, numVariations })
      : await generateWithFirefly({ prompt: opts.prompt, aspectRatio, numVariations });

  return { jobId: outcome.jobId, provider, images: outcome.images };
}
