import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { isValidCategory, isValidKind, loadSettings } from "@/lib/template-settings";
import { designIssues, normalizeDesign, renderHtml } from "@/lib/studio";

// Studio designs are saved as TEMPLATE rows (designType html): body holds the generated HTML and
// aiBrief holds {category, kind, studio: <the blocks>} so the design can be reopened and edited.
// Nothing here sends anything. Auth via /api/admin middleware.
const studioOf = (brief: unknown) =>
  brief && typeof brief === "object" && !Array.isArray(brief) && (brief as Record<string, unknown>).studio ? (brief as Record<string, unknown>) : null;

export async function GET(request: Request) {
  try {
    await ensureCampaignTable();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const row = await prisma.emailCampaign.findUnique({ where: { id } });
      const brief = row?.status === "TEMPLATE" ? studioOf(row.aiBrief) : null;
      if (!row || !brief) return NextResponse.json({ error: "Design not found." }, { status: 404 });
      return NextResponse.json({ success: true, design: { id: row.id, name: row.name, subject: row.subject, previewText: row.previewText, category: brief.category ?? "", kind: brief.kind ?? "", studio: normalizeDesign(brief.studio) } });
    }
    const rows = await prisma.emailCampaign.findMany({ where: { status: "TEMPLATE", designType: "html" }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, name: true, updatedAt: true, aiBrief: true } });
    const designs = rows.filter((r) => studioOf(r.aiBrief)).map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }));
    return NextResponse.json({ success: true, designs });
  } catch (error: any) {
    console.error("studio list failed", error);
    return NextResponse.json({ error: "Could not load your designs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCampaignTable();
    const b = await request.json().catch(() => ({}));
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give the design a name." }, { status: 400 });
    const studio = normalizeDesign(b.studio);
    if (designIssues(studio).some((i) => i.message.startsWith("Add some text"))) return NextResponse.json({ error: "Add some text first, then save." }, { status: 400 });
    const lists = await loadSettings();
    const subject = typeof b.subject === "string" ? b.subject.slice(0, 300) : "";
    const previewText = typeof b.previewText === "string" ? b.previewText.slice(0, 500) : "";
    const data = {
      name, status: "TEMPLATE", designType: "html", subject, previewText,
      body: renderHtml(studio, { title: subject || name }),
      aiBrief: { category: isValidCategory(lists, b.category) ? b.category : "", kind: isValidKind(lists, b.kind) ? b.kind : "", studio } as unknown as Prisma.InputJsonObject,
    };
    if (typeof b.id === "string" && b.id) {
      const existing = await prisma.emailCampaign.findUnique({ where: { id: b.id }, select: { status: true, aiBrief: true } });
      if (!existing || existing.status !== "TEMPLATE" || !studioOf(existing.aiBrief)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
      const row = await prisma.emailCampaign.update({ where: { id: b.id }, data, select: { id: true, name: true } });
      return NextResponse.json({ success: true, design: row });
    }
    const row = await prisma.emailCampaign.create({ data, select: { id: true, name: true } });
    return NextResponse.json({ success: true, design: row });
  } catch (error: any) {
    console.error("studio save failed", error);
    return NextResponse.json({ error: "Could not save the design." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const row = await prisma.emailCampaign.findUnique({ where: { id }, select: { status: true, aiBrief: true } });
    if (!row || row.status !== "TEMPLATE" || !studioOf(row.aiBrief)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("studio delete failed", error);
    return NextResponse.json({ error: "Could not delete the design." }, { status: 500 });
  }
}
