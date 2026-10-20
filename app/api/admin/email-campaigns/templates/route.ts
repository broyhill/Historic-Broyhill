import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { isValidCategory, isValidKind, loadSettings } from "@/lib/template-settings";

// Create or update a saved template for email, SMS or MMS. Stored as a TEMPLATE-status row
// (designType = plain | sms | mms), so it never appears in the campaign list.
// Nothing here sends anything. Auth via /api/admin middleware.
export async function POST(request: Request) {
  try {
    await ensureCampaignTable();
    const b = await request.json().catch(() => ({}));
    const channel = b.channel === "sms" || b.channel === "mms" ? b.channel : "email";
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    const body = typeof b.body === "string" ? b.body.slice(0, 50_000) : "";
    if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
    if (!body.trim()) return NextResponse.json({ error: "The template needs some text." }, { status: 400 });

    // Category and (for MMS) the picture link live in aiBrief, so no extra columns are needed.
    const lists = await loadSettings();
    const aiBrief: { category: string; kind: string; mediaUrl?: string } = {
      category: isValidCategory(lists, b.category) ? b.category : "",
      kind: isValidKind(lists, b.kind) ? b.kind : "",
    };
    if (channel === "mms") aiBrief.mediaUrl = typeof b.mediaUrl === "string" ? b.mediaUrl.trim().slice(0, 500) : "";

    const data = {
      name, status: "TEMPLATE", body,
      designType: channel === "email" ? "plain" : channel,
      subject: channel === "email" && typeof b.subject === "string" ? b.subject.slice(0, 300) : "",
      previewText: channel === "email" && typeof b.previewText === "string" ? b.previewText.slice(0, 500) : "",
      aiBrief,
    };

    if (typeof b.id === "string" && b.id) {
      const existing = await prisma.emailCampaign.findUnique({ where: { id: b.id }, select: { status: true, aiBrief: true } });
      if (!existing || existing.status !== "TEMPLATE") return NextResponse.json({ error: "Template not found." }, { status: 404 });
      const made = existing.aiBrief && typeof existing.aiBrief === "object" && !Array.isArray(existing.aiBrief) && (existing.aiBrief as Record<string, unknown>).studio;
      if (made) return NextResponse.json({ error: "This template was made in the Studio. Open it there to change it." }, { status: 400 });
      const t = await prisma.emailCampaign.update({ where: { id: b.id }, data, select: { id: true, name: true } });
      return NextResponse.json({ success: true, template: t });
    }
    const t = await prisma.emailCampaign.create({ data, select: { id: true, name: true } });
    return NextResponse.json({ success: true, template: t });
  } catch (error: any) {
    console.error("save template failed", error);
    return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  }
}
