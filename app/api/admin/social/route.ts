import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { cleanTags, isPlatform } from "@/lib/social";
import { safeUrl } from "@/lib/studio";

// Social post drafts live in the campaigns table as status SOCIAL (designType "social"): the caption is
// the body, and aiBrief holds {platform, hashtags, mediaUrl, imageAlt, videoUrl}. Nothing here posts anywhere.
// Auth via /api/admin middleware.
const briefOf = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function GET() {
  try {
    await ensureCampaignTable();
    const rows = await prisma.emailCampaign.findMany({ where: { status: "SOCIAL" }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, name: true, body: true, aiBrief: true, updatedAt: true } });
    const posts = rows.map((r) => {
      const b = briefOf(r.aiBrief);
      return {
        id: r.id, title: r.name, caption: r.body, updatedAt: r.updatedAt,
        platform: isPlatform(b.platform) ? b.platform : "facebook",
        hashtags: cleanTags(b.hashtags),
        mediaUrl: typeof b.mediaUrl === "string" ? b.mediaUrl : "",
        videoUrl: typeof b.videoUrl === "string" ? b.videoUrl : "",
        imageAlt: typeof b.imageAlt === "string" ? b.imageAlt : "",
      };
    });
    return NextResponse.json({ success: true, posts });
  } catch (error: any) {
    console.error("social list failed", error);
    return NextResponse.json({ error: "Could not load your drafts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCampaignTable();
    const b = await request.json().catch(() => ({}));
    const caption = typeof b.caption === "string" ? b.caption.slice(0, 5000) : "";
    if (!caption.trim()) return NextResponse.json({ error: "Write the post first." }, { status: 400 });
    const title = (typeof b.title === "string" && b.title.trim() ? b.title.trim() : caption.trim().slice(0, 50)).slice(0, 120);
    const data = {
      name: title, status: "SOCIAL", designType: "social", body: caption,
      aiBrief: {
        platform: isPlatform(b.platform) ? b.platform : "facebook",
        hashtags: cleanTags(b.hashtags),
        mediaUrl: safeUrl(b.mediaUrl),
        videoUrl: safeUrl(b.videoUrl),
        imageAlt: typeof b.imageAlt === "string" ? b.imageAlt.slice(0, 300) : "",
      } as Prisma.InputJsonObject,
    };
    if (typeof b.id === "string" && b.id) {
      const existing = await prisma.emailCampaign.findUnique({ where: { id: b.id }, select: { status: true } });
      if (!existing || existing.status !== "SOCIAL") return NextResponse.json({ error: "Draft not found." }, { status: 404 });
      const row = await prisma.emailCampaign.update({ where: { id: b.id }, data, select: { id: true } });
      return NextResponse.json({ success: true, id: row.id });
    }
    const row = await prisma.emailCampaign.create({ data, select: { id: true } });
    return NextResponse.json({ success: true, id: row.id });
  } catch (error: any) {
    console.error("social save failed", error);
    return NextResponse.json({ error: "Could not save the draft." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const row = await prisma.emailCampaign.findUnique({ where: { id }, select: { status: true } });
    if (!row || row.status !== "SOCIAL") return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("social delete failed", error);
    return NextResponse.json({ error: "Could not delete the draft." }, { status: 500 });
  }
}
