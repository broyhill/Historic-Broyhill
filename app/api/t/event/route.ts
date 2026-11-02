import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTripwireType, recordTripwire } from "@/lib/tripwires";

// General event wire — landing-page beacon, text replies, social engagement.
// POST /api/t/event { lid | email, type, source?, campaignId?, detail?, ... }
// Types: page_visit, form_start, form_submit, rsvp, contract, text_reply,
//        social_engagement, called_back, unopened, bounce, unsubscribe
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { body = null; }
  const lid = body?.lid ?? body?.leadId;
  const email = body?.email;
  const type = body?.type;

  if (!type || !isTripwireType(type)) {
    return NextResponse.json({ ok: false, error: "unknown event type" }, { status: 400 });
  }
  if (!lid && !email) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const lead = lid
    ? await prisma.leadProfile.findUnique({ where: { id: lid } }).catch(() => null)
    : await prisma.leadProfile.findUnique({ where: { email } }).catch(() => null);
  if (!lead) return NextResponse.json({ ok: true, matched: false });

  await recordTripwire({
    leadId: lead.id,
    type,
    source: body.source,
    campaignId: body.campaignId ?? body.c,
    detail: body.detail,
    metadata: {
      url: body.url, path: body.path, referrer: body.referrer,
      channel: body.channel, ua: req.headers.get("user-agent") ?? undefined,
      ...(body.metadata ?? {}),
    },
  });

  return NextResponse.json({ ok: true, matched: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, accepts: "POST" });
}
