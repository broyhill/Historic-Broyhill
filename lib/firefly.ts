// Adobe Firefly provider adapter (v4 async image generation) — spec-verified
// against vendor/adobe-firefly/docs/firefly-api.json (OpenAPI 3.1).
// This is ONE provider behind lib/image-gen.ts — our authored generation
// surface. The app owns the workflow; Adobe is a swappable backend.
// Env vars: ADOBE_FIREFLY_CLIENT_ID + ADOBE_FIREFLY_CLIENT_SECRET.

import { pollAsyncJob, type AsyncJobImage, type AsyncJobOutcome } from "@/lib/async-job";

const FIREFLY_HOST = "https://firefly-api.adobe.io";
const IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3";

export const fireflyEnabled = () =>
  Boolean(process.env.ADOBE_FIREFLY_CLIENT_ID && process.env.ADOBE_FIREFLY_CLIENT_SECRET);

export type { AsyncJobImage as FireflyImage, AsyncJobOutcome as FireflyResult };

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.ADOBE_FIREFLY_CLIENT_ID!,
    client_secret: process.env.ADOBE_FIREFLY_CLIENT_SECRET!,
    scope: "openid,AdobeID,read_organizations,firefly_enterprise,firefly_api,ff_apis",
  });
  const res = await fetch(IMS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Adobe sign-in failed (${res.status}).`);
  return (await res.json()).access_token;
}

// Submits a v4 text-to-image job. v4 takes aspectRatio directly — including
// 9:16, which the old v3 size-table call could not express — and resolves the
// model itself (modelId "firefly_image"), so no per-ratio model pinning is needed.
export async function generateWithFirefly(opts: {
  prompt: string;
  aspectRatio: string;
  numVariations: number;
}): Promise<AsyncJobOutcome> {
  const accessToken = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "x-api-key": process.env.ADOBE_FIREFLY_CLIENT_ID!,
  };

  const submit = await fetch(`${FIREFLY_HOST}/v4/images/generate-async`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      numVariations: opts.numVariations,
      aspectRatio: opts.aspectRatio,
      resolutionLevel: "2.4MP",
      modelId: "firefly_image",
    }),
  });
  if (!submit.ok) {
    throw new Error(`Adobe rejected the request (${submit.status}).`);
  }

  const job = await submit.json();
  const statusUrl: string | undefined = job.statusUrl;
  if (!statusUrl) throw new Error("Adobe returned no status URL for the job.");

  const outcome = await pollAsyncJob(statusUrl, headers, { label: "Adobe" });
  return { jobId: outcome.jobId || job.jobId || "", images: outcome.images };
}
