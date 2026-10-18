import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

// The Resend constructor throws without a key, so only create a client when one is configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const liveDelivery = resend !== null && process.env.NODE_ENV !== "development";

// Splits a leading "Subject: ..." line off the draft; the remaining text becomes the body
function parseDraft(draft: string, fallbackSubject: string) {
  const lines = draft.split("\n");
  const subjectIndex = lines.findIndex((line) => /^\s*subject:/i.test(line));
  if (subjectIndex === -1) return { subjectLine: fallbackSubject, bodyText: draft.trim() };

  const subjectLine = lines[subjectIndex].replace(/^\s*subject:\s*/i, "").trim() || fallbackSubject;
  const bodyText = lines.filter((_, i) => i !== subjectIndex).join("\n").trim();
  return { subjectLine, bodyText };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING_REVIEW";
    const where = status === "ALL" ? {} : { status };

    const campaigns = await prisma.aiContentPipeline.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { business: { select: { businessName: true } } }
    });

    // Attach the originating lead (name, company, LinkedIn, score) to each card for the console
    const leadIds = Array.from(new Set(
      campaigns
        .map((c) => (c.metrics && typeof c.metrics === "object" && !Array.isArray(c.metrics)) ? (c.metrics as Record<string, any>).leadId : null)
        .filter((id): id is string => typeof id === "string")
    ));
    const leads = leadIds.length
      ? await prisma.leadProfile.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, name: true, company: true, email: true, linkedinId: true, leadScore: true }
        })
      : [];
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const enriched = campaigns.map((c) => {
      const m = (c.metrics && typeof c.metrics === "object" && !Array.isArray(c.metrics)) ? c.metrics as Record<string, any> : {};
      return { ...c, lead: typeof m.leadId === "string" ? (leadById.get(m.leadId) ?? null) : null };
    });
    return NextResponse.json({ success: true, campaigns: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, suggestedDraft } = body;
    if (!id || !action) return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });

    if (action === "APPROVE") {
      const campaign = await prisma.aiContentPipeline.findUnique({
        where: { id },
        include: { business: { select: { businessName: true } } }
      });
      if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      if (campaign.status !== "PENDING_REVIEW") {
        return NextResponse.json({ error: `Campaign is ${campaign.status}, not PENDING_REVIEW` }, { status: 409 });
      }

      const metrics = (campaign.metrics && typeof campaign.metrics === "object" && !Array.isArray(campaign.metrics))
        ? campaign.metrics as Record<string, any>
        : {};
      const recipientEmail = typeof metrics.recipientEmail === "string" ? metrics.recipientEmail : null;
      if (!recipientEmail) {
        return NextResponse.json({ error: "Campaign has no recipient email on record" }, { status: 422 });
      }

      const draft = suggestedDraft || campaign.suggestedDraft;
      const { subjectLine, bodyText } = parseDraft(draft, `A note from ${campaign.business.businessName}`);
      const payload = {
        from: process.env.EMAIL_FROM || "Historic Broyhill <onboarding@resend.dev>",
        to: recipientEmail,
        subject: subjectLine,
        text: bodyText,
      };

      let resendId: string;
      let deliveryStatus: string;
      if (liveDelivery && resend) {
        try {
          const { data, error } = await resend.emails.send(payload, { idempotencyKey: `campaign-${campaign.id}` });
          if (error || !data) throw new Error(error?.message || "Resend returned no message ID");
          resendId = data.id;
          deliveryStatus = "SENT";
        } catch (sendError: any) {
          // Leave the campaign in the review queue so it can be retried
          await prisma.aiContentPipeline.update({
            where: { id },
            data: {
              ...(suggestedDraft ? { suggestedDraft } : {}),
              metrics: { ...metrics, deliveryStatus: "FAILED", deliveryError: sendError.message, failedAt: new Date().toISOString() }
            }
          });
          return NextResponse.json({ error: `Email dispatch failed: ${sendError.message}` }, { status: 502 });
        }
      } else {
        resendId = `dry-run-${crypto.randomUUID()}`;
        deliveryStatus = "DRY_RUN";
        console.info("[dry-run] Email not sent", { resendId, ...payload });
      }

      const publishedAt = new Date();
      const updated = await prisma.aiContentPipeline.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt,
          ...(suggestedDraft ? { suggestedDraft } : {}),
          metrics: { ...metrics, resendId, dispatchedAt: publishedAt.toISOString(), deliveryStatus }
        }
      });
      return NextResponse.json({ success: true, campaign: updated });
    }

    let status = "PENDING_REVIEW";
    if (action === "DISMISS") {
      status = "DISMISSED";
    }

    const updated = await prisma.aiContentPipeline.update({
      where: { id },
      data: {
        status,
        publishedAt: null,
        ...(suggestedDraft ? { suggestedDraft } : {})
      }
    });
    return NextResponse.json({ success: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
