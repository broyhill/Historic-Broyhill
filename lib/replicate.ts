// Replicate provider adapter — the budget backup (~$0.003/image on
// FLUX.1 [schnell]). Replicate's prediction API already speaks our async
// envelope: POST → prediction → poll urls.get until "succeeded".
// Env vars: IMAGE_GEN_REPLICATE_TOKEN, optional IMAGE_GEN_REPLICATE_MODEL
// (default black-forest-labs/flux-schnell).

import type { AsyncJobOutcome } from "@/lib/async-job";

const REPLICATE_HOST = "https://api.replicate.com";

export const replicateEnabled = () => Boolean(process.env.IMAGE_GEN_REPLICATE_TOKEN);

export async function generateWithReplicate(opts: {
  prompt: string;
  aspectRatio: string;
  numVariations: number;
}): Promise<AsyncJobOutcome> {
  const model = process.env.IMAGE_GEN_REPLICATE_MODEL || "black-forest-labs/flux-schnell";
  const headers = {
    Authorization: `Bearer ${process.env.IMAGE_GEN_REPLICATE_TOKEN}`,
    "Content-Type": "application/json",
  };

  const submit = await fetch(`${REPLICATE_HOST}/v1/models/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: {
        prompt: opts.prompt,
        aspect_ratio: opts.aspectRatio,
        num_outputs: opts.numVariations,
      },
    }),
  });
  if (!submit.ok) throw new Error(`Replicate rejected the request (${submit.status}).`);

  const prediction = await submit.json();
  const pollUrl: string | undefined = prediction.urls?.get;
  if (!pollUrl) throw new Error("Replicate returned no status URL for the job.");

  for (let attempt = 0, delayMs = 2000; attempt < 20; attempt++) {
    const poll = await fetch(pollUrl, {
      headers: { Authorization: headers.Authorization },
    });
    if (!poll.ok) throw new Error(`Replicate status check failed (${poll.status}).`);
    const status = await poll.json();

    if (status.status === "succeeded") {
      const outputs = Array.isArray(status.output) ? status.output : status.output ? [status.output] : [];
      return {
        jobId: status.id ?? prediction.id ?? "",
        images: outputs.map((u: any, i: number) => ({
          seed: i,
          url: typeof u === "string" ? u : u?.image?.url ?? u?.url,
        })).filter((o: { seed: number; url: string | undefined }) => Boolean(o.url)),
      };
    }
    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(`Replicate generation failed (${status.status}).`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.2, 4000);
  }
  throw new Error("Replicate took too long — the job may still finish; try again.");
}
