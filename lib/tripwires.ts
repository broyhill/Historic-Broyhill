import { prisma } from "@/lib/prisma";

// Trip wires: tiny beacons embedded in landing pages, emails, texts, and social
// touchpoints. When a lead trips one, we log a LeadActivity on their profile —
// the activity feed the profile page shows and the score reads.
//
// Types (aligned with lib/lead-score.ts ENGAGEMENT weights):
//   open, click, page_visit, form_start, form_submit, rsvp, contract,
//   text_reply, social_engagement, called_back, unopened, bounce, unsubscribe

const SCORE: Record<string, number> = {
  open: 6, click: 12, page_visit: 3, form_start: 4, form_submit: 12,
  rsvp: 15, contract: 30, text_reply: 10, social_engagement: 8,
  called_back: 10, unopened: -2, bounce: -20, unsubscribe: -20,
};

export type TripwireType = keyof typeof SCORE;

export function isTripwireType(t: string): t is TripwireType {
  return t in SCORE;
}

/** Log the event on the lead's timeline and bump their stored score. */
export async function recordTripwire(opts: {
  leadId: string;
  type: TripwireType;
  source?: string;
  campaignId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  const { leadId, type, source, campaignId, detail } = opts;
  try {
    await prisma.leadActivity.create({
      data: {
        leadId,
        activityType: type,
        scoreModifier: SCORE[type] ?? 0,
        metadata: {
          source: source ?? null,
          campaignId: campaignId ?? null,
          detail: detail ?? null,
          ...(opts.metadata ?? {}),
        },
      },
    });
    await prisma.leadProfile.update({
      where: { id: leadId },
      data: { leadScore: { increment: SCORE[type] ?? 0 } },
    });
  } catch (e) {
    // A trip wire must never break the page or send that fired it.
    console.warn("tripwire record failed", e);
  }
}

/** 1×1 tracking pixel to append to HTML emails. */
export function openPixelTag(leadId: string, campaignId?: string): string {
  const c = campaignId ? `&c=${encodeURIComponent(campaignId)}` : "";
  return `<img src="/api/t/open?lid=${encodeURIComponent(leadId)}${c}" width="1" height="1" alt="" style="display:none" />`;
}

/** Wrap a destination URL so clicks are logged before redirecting. */
export function clickUrl(to: string, leadId: string, campaignId?: string): string {
  const c = campaignId ? `&c=${encodeURIComponent(campaignId)}` : "";
  return `/api/t/click?lid=${encodeURIComponent(leadId)}${c}&to=${encodeURIComponent(to)}`;
}

/** Rewrite every http(s) href in HTML so clicks trip the wire. */
export function wrapLinks(html: string, leadId: string, campaignId?: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) =>
    `href="${clickUrl(url, leadId, campaignId)}"`
  );
}

/** Plain-text body → tracked HTML: linkify URLs, wrap links, append pixel. */
export function tripwireHtml(textBody: string, leadId: string, campaignId?: string): string {
  const escaped = textBody
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${clickUrl(url, leadId, campaignId)}">${url}</a>`
  );
  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${linkified}</div>${openPixelTag(leadId, campaignId)}`;
}

/** Script tag landing pages include to trip visit + engagement wires. */
export function tripwireSnippet(leadId?: string): string {
  const lid = leadId ? ` data-lead="${leadId}"` : "";
  return `<script src="/tripwire.js"${lid} defer></script>`;
}
