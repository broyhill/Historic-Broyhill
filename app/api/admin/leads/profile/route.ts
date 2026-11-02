import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One lead's profile page: contact fields, enrichment extras carried in
// customFields, plus a merged timeline of everything we did with them —
// lead activities, journey runs and their step log, and published campaign
// sends whose metrics carry this leadId. Auth via /api/admin middleware.
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const lead = await prisma.leadProfile.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 200 },
        journeyRuns: { include: { journey: { select: { name: true } } }, orderBy: { startedAt: "desc" }, take: 50 },
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // Campaign sends that touched this lead — pipeline items carry the leadId
    // inside metrics when the journey runner publishes a step.
    const sends = await prisma.aiContentPipeline.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 500,
      select: { id: true, channel: true, suggestedDraft: true, publishedAt: true, metrics: true },
    });
    const leadSends = sends.filter((s) => (s.metrics as any)?.leadId === id);

    // Flatten into one descending timeline for the profile newsfeed.
    const timeline = [
      ...lead.activities.map((a) => ({
        at: a.createdAt,
        kind: "activity" as const,
        label: a.activityType,
        detail: a.scoreModifier ? `score ${a.scoreModifier > 0 ? "+" : ""}${a.scoreModifier}` : "",
        meta: a.metadata,
      })),
      ...lead.journeyRuns.flatMap((r) => {
        const events = Array.isArray(r.log) ? r.log : [];
        const rows = events.map((e: any) => ({
          at: new Date(e.at ?? r.startedAt),
          kind: "journey" as const,
          label: `${r.journey?.name ?? "Journey"}: ${e.event ?? "step"}`,
          detail: [e.step, e.reason, e.stagedId].filter(Boolean).join(" · "),
          meta: e,
        }));
        rows.push({
          at: r.startedAt,
          kind: "journey" as const,
          label: `${r.journey?.name ?? "Journey"} started`,
          detail: r.status,
          meta: { status: r.status, stoppedReason: r.stoppedReason },
        });
        return rows;
      }),
      ...leadSends.map((s) => ({
        at: s.publishedAt!,
        kind: "send" as const,
        label: `Campaign sent (${s.channel})`,
        detail: (s.metrics as any)?.deliveryStatus ?? "",
        meta: s.metrics,
      })),
    ]
      .filter((t) => t.at && !isNaN(new Date(t.at).getTime()))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 200);

    return NextResponse.json({ success: true, lead, timeline });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
