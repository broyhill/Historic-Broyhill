// OpenAI image provider adapter — gpt-image-1-mini via the Images API.
// Synchronous: returns b64_json payloads, no polling. Uses the OPENAI_API_KEY
// already configured on the project (~$0.005/image on mini). Override the model
// with IMAGE_GEN_OPENAI_MODEL (default: gpt-image-1-mini).

import type { AsyncJobOutcome } from "@/lib/async-job";

const OPENAI_HOST = "https://api.openai.com";

export const openaiEnabled = () => Boolean(process.env.OPENAI_API_KEY);

// OpenAI sizes are width×height; map our aspect ratios to the allowed set.
const OPENAI_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "16:9": "1536x1024",
  "3:4": "1024x1536",
  "9:16": "1024x1536",
};

export async function generateWithOpenAI(opts: {
  prompt: string;
  aspectRatio: string;
  numVariations: number;
}): Promise<AsyncJobOutcome> {
  const model = process.env.IMAGE_GEN_OPENAI_MODEL || "gpt-image-1-mini";
  const res = await fetch(`${OPENAI_HOST}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      n: opts.numVariations,
      size: OPENAI_SIZES[opts.aspectRatio] ?? "1024x1024",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI rejected the request (${res.status}).`);

  const body = await res.json();
  const items = body.data ?? [];
  return {
    jobId: body.created ? String(body.created) : "",
    images: items.map((it: any, i: number) => ({
      seed: i,
      url: it.url ?? "",
      data: it.b64_json,
      contentType: "image/png",
    })),
  };
}
