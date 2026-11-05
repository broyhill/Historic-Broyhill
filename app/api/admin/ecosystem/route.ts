import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Watcher key → the metrics.source stamped on its findings. Channel
// ecosystems (email/texting) report real send activity instead.
const SOURCE: Record<string, string> = {
  competitors: "competitor-watcher",
  reviews: "review-watcher",
  news: "life-events-watcher",
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const source = SOURCE[key];
  const isChannel = key === "email" || key === "texting";
  const channel = key === "texting" ? "SMS" : "EMAIL";

  // Marketing Library folders each ecosystem reads — surfaced in the panel.
  const LIBRARY_FOLDERS: Record<string, string[]> = {
    competitors: ["competitors", "ad-snapshots"],
    market: ["benchmarks", "microsegments"],
    news: ["watch-sources"],
  };
  const libFolders = LIBRARY_FOLDERS[key] ?? [];

  const [log, ctl, findings, statusCounts, channelSent, channelLatest, libraryRows, connections] = await Promise.all([
    prisma.knowledgeEntry.findFirst({ where: { folder: "watch-log", title: key } }),
    prisma.knowledgeEntry.findFirst({ where: { folder: "watch-control", title: key } }),
    source
      ? prisma.aiContentPipeline.findMany({
          where: { metrics: { path: ["source"], equals: source } },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: { id: true, status: true, suggestedDraft: true, createdAt: true },
        })
      : Promise.resolve([] as any[]),
    source
      ? prisma.aiContentPipeline.groupBy({
          by: ["status"],
          where: { metrics: { path: ["source"], equals: source } },
          _count: true,
        })
      : Promise.resolve([] as any[]),
    isChannel
      ? prisma.aiContentPipeline.count({ where: { channel, publishedAt: { not: null } } })
      : Promise.resolve(0),
    isChannel
      ? prisma.aiContentPipeline.findMany({
          where: { channel, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 25,
          select: { id: true, status: true, suggestedDraft: true, publishedAt: true },
        })
      : Promise.resolve([] as any[]),
    libFolders.length
      ? prisma.knowledgeEntry.findMany({ where: { folder: { in: libFolders } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([] as any[]),
    key === "monitoring" ? prisma.vendorConnection.findMany() : Promise.resolve([] as any[]),
  ]);

  const counts: Record<string, number> = {};
  for (const s of statusCounts) counts[s.status] = s._count;
  if (isChannel) counts.PUBLISHED = channelSent;

  return NextResponse.json({
    key,
    enabled: ctl ? (ctl.data as any).enabled !== false : true,
    lastRun: log?.data ?? null,
    counts,
    findings: isChannel
      ? (channelLatest as any[]).map((f) => ({ ...f, createdAt: f.publishedAt }))
      : findings,
    library: libraryRows,
    connections,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const ctl = await prisma.knowledgeEntry.findFirst({ where: { folder: "watch-control", title: body.key } });
  const data = { enabled: Boolean(body.enabled) };
  if (ctl) await prisma.knowledgeEntry.update({ where: { id: ctl.id }, data: { data } });
  else await prisma.knowledgeEntry.create({ data: { folder: "watch-control", title: String(body.key), data } });
  return NextResponse.json({ ok: true, enabled: data.enabled });
}
