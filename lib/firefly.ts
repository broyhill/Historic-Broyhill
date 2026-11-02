// Adobe Firefly (v3 async image generation) — spec-verified against
// vendor/adobe-firefly/docs/firefly-api.json (OpenAPI 3.1).
// Two env vars gate the whole feature: ADOBE_FIREFLY_CLIENT_ID + ADOBE_FIREFLY_CLIENT_SECRET.
// No billing, no tenants — admin middleware already guards the route.

const FIREFLY_HOST = "https://firefly-api.adobe.io";
const IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3";

export const fireflyEnabled = () =>
  Boolean(process.env.ADOBE_FIREFLY_CLIENT_ID && process.env.ADOBE_FIREFLY_CLIENT_SECRET);

export const FIREFLY_NOT_CONFIGURED =
  "Adobe Firefly is not configured (set ADOBE_FIREFLY_CLIENT_ID and ADOBE_FIREFLY_CLIENT_SECRET).";

// The only {width,height} pairs the spec allows for image3/image4.
export const FIREFLY_SIZES: Record<string, { width: number; height: number }> = {
  "1:1": { width: 2048, height: 2048 },
  "4:3": { width: 2304, height: 1792 },
  "3:4": { width: 1792, height: 2304 },
  "16:9": { width: 2688, height: 1536 },
  "9:16": { width: 1440, height: 2560 }, // image4 only
};

export interface FireflyImage {
  seed: number;
  url: string;
}

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
  if (!res.ok) throw new Error(`Adobe sign-in failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

// Submits a text-to-image job, polls the returned statusUrl, and returns the image URLs.
// Polls ~20 times at ~2-4s — inside the route's 60s budget.
export async function generateImages(opts: {
  prompt: string;
  aspectRatio?: keyof typeof FIREFLY_SIZES;
  numVariations?: number;
}): Promise<{ jobId: string; images: FireflyImage[] }> {
  const accessToken = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "x-api-key": process.env.ADOBE_FIREFLY_CLIENT_ID!,
  };

  const submit = await fetch(`${FIREFLY_HOST}/v3/images/generate-async`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      numVariations: Math.min(Math.max(opts.numVariations ?? 1, 1), 4),
      size: FIREFLY_SIZES[opts.aspectRatio ?? "1:1"] ?? FIREFLY_SIZES["1:1"],
      contentClass: "photo",
    }),
  });
  if (!submit.ok) {
    throw new Error(`Adobe rejected the request (${submit.status}): ${await submit.text()}`);
  }

  const job = await submit.json();
  const statusUrl: string | undefined = job.statusUrl;
  if (!statusUrl) throw new Error("Adobe returned no status URL for the job.");

  for (let attempt = 0, delayMs = 2000; attempt < 20; attempt++) {
    const poll = await fetch(statusUrl, { headers });
    if (!poll.ok) throw new Error(`Adobe status check failed (${poll.status}).`);
    const jobStatus = await poll.json();

    if (jobStatus.status === "succeeded") {
      const outputs = jobStatus.result?.outputs ?? [];
      return {
        jobId: jobStatus.jobId ?? job.jobId,
        images: outputs.map((o: any) => ({
          seed: o.seed ?? 0,
          url: o.image?.url ?? o.url,
        })).filter((o: FireflyImage) => Boolean(o.url)),
      };
    }
    if (jobStatus.status === "failed") {
      throw new Error(`Adobe generation failed: ${JSON.stringify(jobStatus.errors ?? jobStatus)}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.2, 4000);
  }
  throw new Error("Adobe took too long — the job may still finish; try again.");
}
