import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { normalizeStoryboard, totalSeconds, type Storyboard } from "@/lib/video";

// Video projects live in the campaigns table as status VIDEO. aiBrief holds {storyboard, checkpoints}:
// the storyboard is the current draft, checkpoints are named saved versions you can return to.
// Nothing here renders, exports or posts. Auth via /api/admin middleware.
const MAX_CHECKPOINTS = 20;
interface Checkpoint { id: string; title: string; at: string; storyboard: Storyboard }
const briefOf = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const checkpointsOf = (brief: Record<string, unknown>): Checkpoint[] =>
  (Array.isArray(brief.checkpoints) ? brief.checkpoints : []).flatMap((c) => {
    const x = briefOf(c);
    return typeof x.id === "string" && typeof x.title === "string" ? [{ id: x.id, title: x.title.slice(0, 80), at: typeof x.at === "string" ? x.at : "", storyboard: normalizeStoryboard(x.storyboard) }] : [];
  });

export async function GET(request: Request) {
  try {
    await ensureCampaignTable();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const row = await prisma.emailCampaign.findUnique({ where: { id }, select: { id: true, name: true, status: true, aiBrief: true } });
      if (!row || row.status !== "VIDEO") return NextResponse.json({ error: "Video not found." }, { status: 404 });
      const b = briefOf(row.aiBrief);
      return NextResponse.json({ success: true, video: { id: row.id, name: row.name, storyboard: normalizeStoryboard(b.storyboard), checkpoints: checkpointsOf(b) } });
    }
    const rows = await prisma.emailCampaign.findMany({ where: { status: "VIDEO" }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, updatedAt: true, aiBrief: true } });
    return NextResponse.json({ success: true, videos: rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, seconds: totalSeconds(normalizeStoryboard(briefOf(r.aiBrief).storyboard)) })) });
  } catch (error: any) {
    console.error("video list failed", error);
    return NextResponse.json({ error: "Could not load your videos." }, { status: 500 });
  }
}

// Save the draft (and optionally add a named checkpoint).
export async function POST(request: Request) {
  try {
    await ensureCampaignTable();
    const b = await request.json().catch(() => ({}));
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give the video a name." }, { status: 400 });
    const storyboard = normalizeStoryboard(b.storyboard);
    if (!storyboard.scenes.length) return NextResponse.json({ error: "Add at least one picture, then save." }, { status: 400 });

    let checkpoints: Checkpoint[] = [];
    let existing: { status: string; aiBrief: unknown } | null = null;
    if (typeof b.id === "string" && b.id) {
      existing = await prisma.emailCampaign.findUnique({ where: { id: b.id }, select: { status: true, aiBrief: true } });
      if (!existing || existing.status !== "VIDEO") return NextResponse.json({ error: "Video not found." }, { status: 404 });
      checkpoints = checkpointsOf(briefOf(existing.aiBrief));
    }
    const title = typeof b.checkpointTitle === "string" ? b.checkpointTitle.trim().slice(0, 80) : "";
    if (title) checkpoints = [{ id: `cp${Date.now().toString(36)}`, title, at: new Date().toISOString(), storyboard }, ...checkpoints].slice(0, MAX_CHECKPOINTS);

    const data = { name, status: "VIDEO", designType: "video", body: "", aiBrief: { storyboard, checkpoints } as unknown as Prisma.InputJsonObject };
    if (existing && typeof b.id === "string") {
      const row = await prisma.emailCampaign.update({ where: { id: b.id }, data, select: { id: true } });
      return NextResponse.json({ success: true, id: row.id, checkpoints });
    }
    const row = await prisma.emailCampaign.create({ data, select: { id: true } });
    return NextResponse.json({ success: true, id: row.id, checkpoints });
  } catch (error: any) {
    console.error("video save failed", error);
    return NextResponse.json({ error: "Could not save the video." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const row = await prisma.emailCampaign.findUnique({ where: { id }, select: { status: true } });
    if (!row || row.status !== "VIDEO") return NextResponse.json({ error: "Video not found." }, { status: 404 });
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("video delete failed", error);
    return NextResponse.json({ error: "Could not delete the video." }, { status: 500 });
  }
}
