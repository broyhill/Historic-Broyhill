// Shared poller for async generation jobs. Both the Adobe Firefly adapter and
// our own engine adapter submit a job that returns a statusUrl; this polls it
// until the job settles. Provider responses are normalized to { jobId, images }.

export interface AsyncJobImage {
  seed: number;
  url: string;
}

export interface AsyncJobOutcome {
  jobId: string;
  images: AsyncJobImage[];
}

// Polls ~20 times starting at 2s, backing off to 4s — inside the route's 60s budget.
export async function pollAsyncJob(
  statusUrl: string,
  headers: Record<string, string>,
  opts: { attempts?: number; label?: string } = {},
): Promise<AsyncJobOutcome> {
  const attempts = opts.attempts ?? 20;
  const label = opts.label ?? "Provider";
  for (let attempt = 0, delayMs = 2000; attempt < attempts; attempt++) {
    const poll = await fetch(statusUrl, { headers });
    if (!poll.ok) throw new Error(`${label} status check failed (${poll.status}).`);
    const jobStatus = await poll.json();

    if (jobStatus.status === "succeeded") {
      const outputs = jobStatus.result?.outputs ?? jobStatus.images ?? [];
      return {
        jobId: jobStatus.jobId ?? "",
        images: outputs
          .map((o: any) => ({ seed: o.seed ?? 0, url: o.image?.url ?? o.url }))
          .filter((o: AsyncJobImage) => Boolean(o.url)),
      };
    }
    if (jobStatus.status === "failed") {
      throw new Error(`${label} generation failed.`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.2, 4000);
  }
  throw new Error(`${label} took too long — the job may still finish; try again.`);
}
