import { NextResponse } from "next/server";
import { Resend } from "resend";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { fillFirstName, isEmail, MAX_TEST_ADDRESSES, unresolvedTags, VENUE_ADDRESS } from "@/lib/campaign-rules";

type Ctx = { params: Promise<{ id: string }> };

// Same delivery rule as the review queue: real send only when a Resend key is set
// and this is not development; otherwise a dry run that logs and sends nothing.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const liveDelivery = resend !== null && process.env.NODE_ENV !== "development";

// Phase 1 sends only to the few addresses typed here. There is no list send.
export async function POST(request: Request, { params }: Ctx) {
  try {
    await ensureCampaignTable();
    const { id } = await params;
    const c = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (!c.subject.trim() || !c.body.trim()) return NextResponse.json({ error: "Add a subject and body before sending a test." }, { status: 400 });

    const blanks = unresolvedTags(`${c.subject}\n${c.previewText}\n${c.body}`);
    if (blanks.length) return NextResponse.json({ error: `Fill in these blanks first: ${blanks.map((t) => `{{${t}}}`).join(", ")}` }, { status: 400 });

    const b = await request.json().catch(() => ({}));
    const to: string[] = Array.from(new Set((Array.isArray(b.to) ? b.to : []).map((v: unknown) => String(v).trim().toLowerCase()).filter(Boolean)));
    if (!to.length) return NextResponse.json({ error: "Enter at least one email address." }, { status: 400 });
    if (to.length > MAX_TEST_ADDRESSES) return NextResponse.json({ error: `Test sends are limited to ${MAX_TEST_ADDRESSES} addresses.` }, { status: 400 });
    const bad = to.filter((e) => !isEmail(e));
    if (bad.length) return NextResponse.json({ error: `Not a valid email: ${bad.join(", ")}` }, { status: 400 });

    // Sent from the verified platform address; the campaign sender is shown in the body and used for replies.
    const text = [
      `[TEST SEND — this was not sent to your list]`,
      `From name on the real send: ${c.fromName || "(not set)"} <${c.fromEmail || "not set"}>`,
      "",
      c.previewText ? `Preview text: ${fillFirstName(c.previewText, null)}\n` : "",
      fillFirstName(c.body.trim(), null),
      "",
      "--",
      VENUE_ADDRESS,
    ].join("\n");

    const results: { to: string; id: string; mode: "SENT" | "DRY_RUN" }[] = [];
    for (const address of to) {
      if (liveDelivery && resend) {
        const { data, error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || "Historic Broyhill <onboarding@resend.dev>",
          to: address,
          replyTo: c.replyTo || c.fromEmail || undefined,
          subject: `[TEST] ${fillFirstName(c.subject.trim(), null)}`,
          text,
        });
        if (error || !data) return NextResponse.json({ error: `Email service refused the test: ${error?.message || "no message id"}` }, { status: 502 });
        results.push({ to: address, id: data.id, mode: "SENT" });
      } else {
        console.info("[dry-run] Test email not sent", { to: address, subject: c.subject });
        results.push({ to: address, id: `dry-run-${crypto.randomUUID()}`, mode: "DRY_RUN" });
      }
    }

    const log: Prisma.InputJsonValue[] = Array.isArray(c.testSends) ? (c.testSends as Prisma.InputJsonValue[]) : [];
    await prisma.emailCampaign.update({
      where: { id },
      data: { testSends: [...log.slice(-19), { at: new Date().toISOString(), results }] },
    });
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("test send failed", error);
    return NextResponse.json({ error: "Could not send the test." }, { status: 500 });
  }
}
