import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { completeness } from "@/lib/campaign-rules";

// Campaign list + create. Auth via /api/admin middleware.
// Saved templates are campaign rows with status TEMPLATE (no extra table). They are
// listed only with ?templates=1 and never appear in the campaign list.
export async function GET(request: Request) {
  try {
    await ensureCampaignTable();
    const params = new URL(request.url).searchParams;
    if (params.get("templates") === "1") {
      // Channel is kept in designType: plain/html = email, "sms", "mms". Media link for MMS lives in aiBrief.mediaUrl.
      const channel = params.get("channel") || "email";
      const rows = await prisma.emailCampaign.findMany({
        where: { status: "TEMPLATE", designType: channel === "email" ? { in: ["plain", "html"] } : channel },
        orderBy: { updatedAt: "desc" }, take: 100,
        select: { id: true, name: true, subject: true, previewText: true, body: true, aiBrief: true, updatedAt: true },
      });
      const templates = rows.map(({ aiBrief, ...t }) => {
        const brief = aiBrief && typeof aiBrief === "object" && !Array.isArray(aiBrief) ? (aiBrief as Record<string, unknown>) : {};
        return {
          ...t,
          mediaUrl: typeof brief.mediaUrl === "string" ? brief.mediaUrl : "",
          category: typeof brief.category === "string" ? brief.category : "",
          kind: typeof brief.kind === "string" ? brief.kind : "",
        };
      });
      return NextResponse.json({ success: true, templates });
    }
    const rows = await prisma.emailCampaign.findMany({ where: { status: { not: "TEMPLATE" } }, orderBy: { updatedAt: "desc" }, take: 100 });
    return NextResponse.json({
      success: true,
      campaigns: rows.map((c) => ({
        id: c.id, name: c.name, status: c.status, subject: c.subject,
        recipientCount: c.recipientCount, updatedAt: c.updatedAt,
        done: Object.values(completeness(c)).filter(Boolean).length,
      })),
    });
  } catch (error: any) {
    console.error("list campaigns failed", error);
    return NextResponse.json({ error: "Could not load campaigns." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCampaignTable();
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give the campaign a name." }, { status: 400 });

    // Like Campaign Monitor, a new draft copies the sender from the most recent campaign.
    const last = await prisma.emailCampaign.findFirst({ where: { status: { not: "TEMPLATE" } }, orderBy: { createdAt: "desc" }, select: { fromName: true, fromEmail: true, replyTo: true } });
    const envFrom = /^(.*)<(.+)>$/.exec(process.env.EMAIL_FROM || "");
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        fromName: last?.fromName || envFrom?.[1].trim() || "Historic Broyhill",
        fromEmail: last?.fromEmail || envFrom?.[2].trim() || "",
        replyTo: last?.replyTo ?? null,
      },
    });
    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error("create campaign failed", error);
    return NextResponse.json({ error: "Could not create the campaign." }, { status: 500 });
  }
}
