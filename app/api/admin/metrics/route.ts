import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const since = new Date(Date.now() - 16 * 86400000);
    const [totalLeads, pendingCount, publishedCount, expressPending, tentativeEvents, activeJourneys, leadDays, draftDays, vipCount, recentLeads, recentDrafts, recentRequests, recentEvents] = await Promise.all([
      prisma.leadProfile.count(),
      prisma.aiContentPipeline.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.aiContentPipeline.count({ where: { status: "PUBLISHED" } }),
      prisma.expressBookRequest.count({ where: { status: "PENDING" } }),
      prisma.venueEvent.count({ where: { status: "TENTATIVE" } }),
      prisma.journey.count({ where: { status: "ACTIVE" } }),
      prisma.leadProfile.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.aiContentPipeline.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.leadProfile.count({
        where: {
          OR: [
            { primaryTrack: { contains: "VIP", mode: "insensitive" } },
            { leadScore: { gte: 80 } }
          ]
        }
      }),
      prisma.leadProfile.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { name: true, email: true, createdAt: true } }),
      prisma.aiContentPipeline.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { channel: true, status: true, suggestedDraft: true, createdAt: true } }),
      prisma.expressBookRequest.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { name: true, status: true, createdAt: true } }),
      prisma.venueEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { name: true, status: true, createdAt: true } })
    ]);

    const reviewRate = (pendingCount + publishedCount) > 0
      ? Math.round((publishedCount / (pendingCount + publishedCount)) * 100)
      : 0;

    const series: { leads: number[]; drafts: number[] } = { leads: new Array(16).fill(0), drafts: new Array(16).fill(0) };
    const dayIdx = (d: Date) => Math.min(15, Math.floor((Date.now() - d.getTime()) / 86400000) > 15 ? -1 : 15 - Math.floor((Date.now() - d.getTime()) / 86400000));
    for (const r of leadDays) { const i = dayIdx(r.createdAt); if (i >= 0) series.leads[i]++; }
    for (const r of draftDays) { const i = dayIdx(r.createdAt); if (i >= 0) series.drafts[i]++; }

    const feed = [
      ...recentLeads.map((l) => ({ kind: "lead", who: l.name || l.email, text: "inquired about the venue", when: l.createdAt })),
      ...recentDrafts.map((d) => ({ kind: "draft", who: d.channel === "SMS" ? "Text studio" : "Email studio", text: `drafted ${d.status === "PUBLISHED" ? "and sent" : "for review"}: ${String(d.suggestedDraft).slice(0, 90)}`, when: d.createdAt })),
      ...recentRequests.map((r) => ({ kind: "request", who: r.name, text: `requested a date (${r.status.toLowerCase()})`, when: r.createdAt })),
      ...recentEvents.map((e) => ({ kind: "event", who: e.name, text: `event ${e.status.toLowerCase()}`, when: e.createdAt }))
    ].sort((a, b) => +new Date(b.when) - +new Date(a.when)).slice(0, 25);

    return NextResponse.json({
      success: true,
      metrics: {
        totalLeads,
        pendingReview: pendingCount,
        publishedBroadcasts: publishedCount,
        vipLeads: vipCount,
        reviewRate: `${reviewRate}%`,
        expressPending,
        tentativeEvents,
        activeJourneys,
        series,
        feed
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
