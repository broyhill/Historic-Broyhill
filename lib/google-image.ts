// Google Imagen provider adapter (Gemini API). Cheaper than Adobe's enterprise
// tier (~$0.02/image on Imagen 4 Fast) and synchronous — returns base64 images
// directly, no job polling. One env var: IMAGE_GEN_GOOGLE_KEY.
// Override the model with IMAGE_GEN_GOOGLE_MODEL (default: imagen-4.0-fast-generate-001).

import type { AsyncJobOutcome } from "@/lib/async-job";

const GEMINI_HOST = "https://generativelanguage.googleapis.com";

export const googleEnabled = () => Boolean(process.env.IMAGE_GEN_GOOGLE_KEY);

export async function generateWithGoogle(opts: {
  prompt: string;
  aspectRatio: string;
  numVariations: number;
}): Promise<AsyncJobOutcome> {
  const model = process.env.IMAGE_GEN_GOOGLE_MODEL || "imagen-4.0-fast-generate-001";
  const res = await fetch(`${GEMINI_HOST}/v1beta/models/${model}:predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.IMAGE_GEN_GOOGLE_KEY!,
    },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt }],
      parameters: {
        sampleCount: opts.numVariations,
        aspectRatio: opts.aspectRatio,
      },
    }),
  });
  if (!res.ok) throw new Error(`Google rejected the request (${res.status}).`);

  const body = await res.json();
  const predictions = body.predictions ?? [];
  return {
    jobId: "",
    images: predictions.map((p: any, i: number) => ({
      seed: i,
      url: "",
      data: p.bytesBase64Encoded,
      contentType: p.mimeType || "image/png",
    })),
  };
}
