import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Watcher key → the metrics.source stamped on its findings, and the library
// folder it reads. Non-watcher ecosystems map to no source yet.
const SOURCE: Record<string, string> = {
  competitors: "competitor-watcher",
  reviews: "review-watcher",
  news: "life-events-watcher",
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const source = SOURCE[key];

  const [log, ctl, findings, statusCounts] = await Promise.all([
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
  ]);

  const counts: Record<string, number> = {};
  for (const s of statusCounts) counts[s.status] = s._count;

  return NextResponse.json({
    key,
    enabled: ctl ? (ctl.data as any).enabled !== false : true,
    lastRun: log?.data ?? null,
    counts,
    findings,
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
