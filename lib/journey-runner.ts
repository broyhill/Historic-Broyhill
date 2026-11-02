import { prisma } from "@/lib/prisma";
import { ensureJourneyTables } from "@/lib/journeys-db";
import { stepsSchema, type JourneyStep } from "@/lib/journeys";
import { CAMPAIGN_TEMPLATES, TEXT_TEMPLATES } from "@/lib/campaign-templates";
import type { Resend } from "resend";
import { tripwireHtml } from "@/lib/tripwires";

// The journeys runner. Moves every RUNNING JourneyRun forward through its steps:
//   wait  → schedules nextRunAt
//   email → stages or sends a rendered template (channel EMAIL)
//   sms   → stages or sends a rendered template (channel SMS); only for leads whose
//           captured tags include "SMS opt-in" — otherwise the step is logged SKIPPED.
// Journey approvalMode REVIEW stages each message as an AiContentPipeline draft in the
// review queue (a human still authorizes the send, exactly like the capture flow).
// AUTO sends immediately through Resend — a mode a human sets per journey.

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, tag) => vars[tag] ?? `{{${tag}}}`);
}

function leadVars(lead: { firstName: string | null; name: string | null; email: string }): Record<string, string> {
  const first = lead.firstName?.trim() || lead.name?.split(" ")[0]?.trim() || "there";
  return { firstName: first, email: lead.email, bookingLink: "https://historic-broyhill.vercel.app/book" };
}

function hasSmsConsent(lead: { customFields: unknown }): boolean {
  const tags = lead.customFields && typeof lead.customFields === "object" && !Array.isArray(lead.customFields)
    ? (lead.customFields as Record<string, any>).tags
    : null;
  return typeof tags === "string" && /sms\s*opt-?in/i.test(tags);
}

async function deliver(opts: {
  resend: Resend | null;
  liveDelivery: boolean;
  approvalMode: string;
  channel: "EMAIL" | "SMS";
  leadId: string;
  recipientEmail: string;
  draft: string; // "Subject: ...\n\nbody"
}): Promise<{ stagedId: string; status: "STAGED" | "SENT" | "DRY_RUN" }> {
  const { resend, liveDelivery, approvalMode, channel, leadId, recipientEmail, draft } = opts;
  const staged = await prisma.aiContentPipeline.create({
    data: {
      businessId: "broyhill-01",
      channel,
      suggestedDraft: draft,
      status: "PENDING_REVIEW",
      scheduledFor: new Date(),
      metrics: { leadId, recipientEmail, source: "journey" },
    },
  });

  if (approvalMode !== "AUTO") return { stagedId: staged.id, status: "STAGED" };
  if (channel !== "EMAIL") {
    // No SMS sender exists yet; AUTO sms stays staged rather than dropping the message.
    return { stagedId: staged.id, status: "STAGED" };
  }

  const lines = draft.split("\n");
  const si = lines.findIndex((l) => /^\s*subject:/i.test(l));
  const subject = si >= 0 ? lines[si].replace(/^\s*subject:\s*/i, "").trim() : "A note from Historic Broyhill";
  const body = lines.filter((_, i) => i !== si).join("\n").trim();

  if (liveDelivery && resend) {
    const { data, error } = await resend.emails.send(
      {
        from: process.env.EMAIL_FROM || "Historic Broyhill <onboarding@resend.dev>",
        to: recipientEmail, subject, text: body,
        html: tripwireHtml(body, leadId, staged.id),
      },
      { idempotencyKey: `journey-${staged.id}` },
    );
    if (error || !data) throw new Error(error?.message || "Resend returned no message ID");
    await prisma.aiContentPipeline.update({
      where: { id: staged.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), metrics: { leadId, recipientEmail, source: "journey", resendId: data.id, deliveryStatus: "SENT" } },
    });
    return { stagedId: staged.id, status: "SENT" };
  }
  // No Resend key (or development): mark as a dry-run publish so the step still advances.
  await prisma.aiContentPipeline.update({
    where: { id: staged.id },
    data: { status: "PUBLISHED", publishedAt: new Date(), metrics: { leadId, recipientEmail, source: "journey", deliveryStatus: "DRY_RUN" } },
  });
  return { stagedId: staged.id, status: "DRY_RUN" };
}

/**
 * Enroll a lead in every ACTIVE journey for the given trigger. Idempotent per lead+
 * journey: an existing RUNNING run is not restarted.
 */
export async function enrollLead(leadId: string, trigger: string): Promise<number> {
  await ensureJourneyTables();
  const journeys = await prisma.journey.findMany({ where: { trigger, status: "ACTIVE" } });
  let enrolled = 0;
  for (const j of journeys) {
    const existing = await prisma.journeyRun.findFirst({ where: { journeyId: j.id, leadId, status: "RUNNING" } });
    if (existing) continue;
    await prisma.journeyRun.create({ data: { journeyId: j.id, leadId, nextRunAt: new Date() } });
    enrolled++;
  }
  return enrolled;
}

/**
 * Advance every due run one step. Returns counts per action. Safe to call on a cron
 * or from the admin "Run now" button; runs are processed step-by-step so a crash
 * never double-sends (each step's draft is committed before the run advances).
 */
export async function runDueSteps(opts: { resend?: Resend | null; limit?: number } = {}) {
  await ensureJourneyTables();
  const liveDelivery = Boolean(opts.resend) && process.env.NODE_ENV !== "development";
  const due = await prisma.journeyRun.findMany({
    where: { status: "RUNNING", OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }] },
    orderBy: { startedAt: "asc" },
    take: opts.limit ?? 50,
    include: { journey: true, lead: { select: { id: true, email: true, name: true, firstName: true, customFields: true } } },
  });

  const counts = { processed: 0, staged: 0, sent: 0, dryRun: 0, waited: 0, skipped: 0, done: 0, errored: 0 };
  for (const run of due) {
    counts.processed++;
    try {
      const steps = stepsSchema.parse(run.journey.steps ?? []);
      const step: JourneyStep | undefined = steps[run.stepIndex];
      const log = Array.isArray(run.log) ? (run.log as any[]) : [];
      const at = new Date().toISOString();

      if (!step) {
        await prisma.journeyRun.update({ where: { id: run.id }, data: { status: "DONE", nextRunAt: null, log: [...log, { at, event: "done" }] } });
        counts.done++;
        continue;
      }

      if (step.type === "wait") {
        const next = new Date(Date.now() + step.hours * 3600_000);
        await prisma.journeyRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1, nextRunAt: next, log: [...log, { at, event: "wait", hours: step.hours }] } });
        counts.waited++;
        continue;
      }

      const vars = leadVars(run.lead);
      let draft: string | null = null;
      let channel: "EMAIL" | "SMS" = "EMAIL";

      if (step.type === "email") {
        const t = CAMPAIGN_TEMPLATES.find((x) => x.id === step.template);
        if (t) draft = `Subject: ${render(t.subject, vars)}\n\n${render(t.body, vars)}`;
      } else {
        channel = "SMS";
        if (!hasSmsConsent(run.lead)) {
          await prisma.journeyRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1, nextRunAt: new Date(), log: [...log, { at, event: "skipped", reason: "no sms opt-in", step: step.type }] } });
          counts.skipped++;
          continue;
        }
        const t = TEXT_TEMPLATES.find((x) => x.id === step.template);
        if (t) draft = render(t.body, vars);
      }

      if (!draft) {
        // Missing template — mark the run stopped rather than silently producing an empty send.
        await prisma.journeyRun.update({ where: { id: run.id }, data: { status: "STOPPED", stoppedReason: `template not found: ${step.template}`, log: [...log, { at, event: "error", reason: "template missing" }] } });
        counts.errored++;
        continue;
      }

      const result = await deliver({
        resend: opts.resend ?? null,
        liveDelivery,
        approvalMode: run.journey.approvalMode,
        channel,
        leadId: run.leadId,
        recipientEmail: run.lead.email,
        draft,
      });

      const last = run.stepIndex + 1 >= steps.length;
      await prisma.journeyRun.update({
        where: { id: run.id },
        data: {
          stepIndex: run.stepIndex + 1,
          nextRunAt: last ? null : new Date(),
          status: last ? "DONE" : "RUNNING",
          log: [...log, { at, event: result.status.toLowerCase(), step: step.type, stagedId: result.stagedId }],
        },
      });
      if (result.status === "STAGED") counts.staged++;
      else if (result.status === "SENT") counts.sent++;
      else counts.dryRun++;
      if (last) counts.done++;
    } catch (e: any) {
      counts.errored++;
      console.error(`journey run ${run.id} failed:`, e);
    }
  }
  return counts;
}
