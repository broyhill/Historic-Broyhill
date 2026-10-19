import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLeadWhere } from "@/lib/leads-query";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { completeness, isReady } from "@/lib/campaign-rules";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

function view(c: Awaited<ReturnType<typeof prisma.emailCampaign.findUniqueOrThrow>>) {
  return { ...c, completeness: completeness(c) };
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await ensureCampaignTable();
    const { id } = await params;
    const c = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ success: true, campaign: view(c) });
  } catch (error: any) {
    console.error("get campaign failed", error);
    return NextResponse.json({ error: "Could not load the campaign." }, { status: 500 });
  }
}

// Saves any subset of the checklist sections. Recipient count is always recomputed
// from the saved filter so it can never be set by hand.
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await ensureCampaignTable();
    const { id } = await params;
    const existing = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const b = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const text = (key: string, max: number) => { const v = str(b[key], max); if (v !== undefined) data[key] = v; };
    text("name", 120); text("subject", 300); text("previewText", 500);
    text("fromName", 120); text("fromEmail", 200); text("body", 50_000);
    if (b.replyTo === null || typeof b.replyTo === "string") data.replyTo = b.replyTo ? String(b.replyTo).slice(0, 200) : null;
    if (b.designType === "plain" || b.designType === "html") data.designType = b.designType;

    if (b.recipientFilter && typeof b.recipientFilter === "object") {
      const f = b.recipientFilter as Record<string, unknown>;
      const filter = { q: str(f.q, 200) ?? "", status: str(f.status, 40) ?? "", track: str(f.track, 60) ?? "", gap: str(f.gap, 30) ?? "" };
      data.recipientFilter = filter;
      data.recipientCount = await prisma.leadProfile.count({ where: buildLeadWhere(filter) });
    }
    if (b.aiBrief && typeof b.aiBrief === "object") data.aiBrief = b.aiBrief;

    const merged = { ...existing, ...data } as typeof existing;
    data.status = isReady(completeness(merged)) ? "READY" : "DRAFT";

    const updated = await prisma.emailCampaign.update({ where: { id }, data });
    return NextResponse.json({ success: true, campaign: view(updated) });
  } catch (error: any) {
    console.error("save campaign failed", error);
    return NextResponse.json({ error: "Could not save the campaign." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await ensureCampaignTable();
    const { id } = await params;
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Could not delete the campaign." }, { status: 404 });
  }
}
