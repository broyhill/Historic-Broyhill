import { prisma } from "@/lib/prisma";
import { ecoEnabled } from "@/lib/eco-control";

// The wizard's eyes. Each watcher reads its folder in the Marketing Library
// (KnowledgeEntry), fetches what it can reach, and files findings as
// PENDING_REVIEW rows in AiContentPipeline — which is what surfaces in the
// Needs-you queue. Every watcher degrades to an honest status note when its
// credential or source is missing; nothing fails silently.

async function library(folder: string) {
  return prisma.knowledgeEntry.findMany({ where: { folder, enabled: true } });
}



async function logRun(watcher: string, result: { pulled: number; note?: string }) {
  const existing = await prisma.knowledgeEntry.findFirst({ where: { folder: "watch-log", title: watcher } });
  const data = { ...result, at: new Date().toISOString() };
  if (existing) await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: { data } });
  else await prisma.knowledgeEntry.create({ data: { folder: "watch-log", title: watcher, data } });
}

async function fileFinding(kind: string, title: string, draft: string, metrics: Record<string, unknown>) {
  const existing = await prisma.aiContentPipeline.findFirst({
    where: { status: "PENDING_REVIEW", metrics: { path: ["watcherDedupe"], equals: String(metrics.watcherDedupe) } },
  });
  if (existing) return null;
  return prisma.aiContentPipeline.create({
    data: {
      businessId: "broyhill-01",
      channel: kind,
      suggestedDraft: `Subject: ${title}\n\n${draft}`,
      status: "PENDING_REVIEW",
      scheduledFor: new Date(),
      metrics: metrics as any,
    },
  });
}

export async function runWatchers() {
  const results: Record<string, { pulled: number; note?: string }> = {};
  const enabled = {
    competitors: await ecoEnabled("competitors"),
    reviews: await ecoEnabled("reviews"),
    news: await ecoEnabled("news"),
  };

  // --- Competitor ads (Meta Ad Library) ---
  const competitors = enabled.competitors ? await library("competitors") : [];
  const meta = await prisma.vendorConnection.findUnique({ where: { vendor: "meta" } });
  const metaToken = (meta?.meta as any)?.accessToken;
  let pulled = 0;
  if (!metaToken) {
    results.competitors = { pulled: 0, note: "Meta not connected — connect it in Connections, then ads surface here" };
  } else {
    for (const c of competitors) {
      const page = (c.data as any).metaPage || c.title;
      try {
        const r = await fetch(
          `https://graph.facebook.com/v19.0/ads_archive?search_terms=${encodeURIComponent(page)}&ad_reached_countries=US&ad_active_status=ACTIVE&fields=ad_snapshot_url,ad_delivery_start_time,publisher_platforms&access_token=${metaToken}&limit=10`
        );
        const j = await r.json().catch(() => ({}));
        const ads = j.data || [];
        for (const ad of ads.slice(0, 5)) {
          const since = ad.ad_delivery_start_time;
          const days = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : null;
          await fileFinding(
            "COMPETITOR_AD",
            `${c.title}: ad running ${days !== null ? days + " days" : "now"}`,
            `${c.title} has an active ad on ${(ad.publisher_platforms || []).join(", ") || "Meta"}${
              days !== null ? ` running ${days} days — duration is the signal it's working.` : "."
            }\n\nSnapshot: ${ad.ad_snapshot_url || "n/a"}`,
            { watcherDedupe: `comp-${c.id}-${ad.ad_snapshot_url || since}`, source: "competitor-watcher", competitor: c.title, days }
          );
          pulled++;
        }
      } catch {
        /* single competitor failing shouldn't kill the sweep */
      }
    }
    results.competitors = { pulled };
  }
  if (!enabled.competitors) results.competitors = { pulled: 0, note: "disabled in admin" };

  // --- Reviews (Google Places) ---
  const placeKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!enabled.reviews) {
    results.reviews = { pulled: 0, note: "disabled in admin" };
  } else if (!placeKey || !placeId) {
    results.reviews = { pulled: 0, note: "GOOGLE_PLACES_API_KEY / GOOGLE_PLACE_ID not set" };
  } else {
    try {
      const r = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?fields=reviews&key=${placeKey}`
      );
      const j = await r.json().catch(() => ({}));
      const reviews = j.reviews || [];
      let n = 0;
      for (const rev of reviews) {
        const when = rev.publishTime;
        await fileFinding(
          "REVIEW",
          `New ${rev.rating}-star review from ${rev.authorAttribution?.displayName || "a guest"}`,
          `"${rev.text?.text || ""}"\n\nDraft a reply from this review and send it to the queue.`,
          { watcherDedupe: `rev-${rev.name || when}`, source: "review-watcher", rating: rev.rating }
        );
        n++;
      }
      results.reviews = { pulled: n };
    } catch {
      results.reviews = { pulled: 0, note: "places fetch failed" };
    }
  }

  // --- Local paper life-events scan (RSS feeds in the watch-sources folder) ---
  const sources = enabled.news ? await library("watch-sources") : [];
  let news = 0;
  for (const s of sources) {
    const url = (s.data as any).url || s.title;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].slice(0, 15);
      for (const m of items) {
        const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        if (/engag|wedding|announc|marri/i.test(title)) {
          await fileFinding(
            "LIFE_EVENT",
            `Possible lead: ${title}`,
            `Engagement/wedding news in your 30-mile draw:\n${title}\n${m[2]}\n\nConsider a congrats note or tour invite.`,
            { watcherDedupe: `news-${m[2]}`, source: "life-events-watcher", link: m[2] }
          );
          news++;
        }
      }
    } catch {
      /* feed down — skip */
    }
  }
  results.news = { pulled: news, note: !enabled.news ? "disabled in admin" : sources.length === 0 ? 'add RSS feeds to the "watch-sources" folder in Marketing Library' : undefined };

  // Log only real runs — a disabled organ keeps its last actual run, not a
  // "disabled" stamp that would mislabel the panel's Last run line.
  for (const [watcher, result] of Object.entries(results)) {
    if (result.note !== "disabled in admin") await logRun(watcher, result).catch(() => {});
  }
  return results;
}
