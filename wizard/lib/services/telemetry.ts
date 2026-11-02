// Telemetry and suppression writes: Resend webhook events and one-click unsubscribes.

import { Prisma, type PrismaClient, type SuppressionLevel } from '@prisma/client';
import { mergeLevel } from '../compliance/suppression';
import { verifyUnsubscribeToken } from '../compliance/unsubscribe';
import { planForEvent, type ResendEvent } from '../webhooks/resend';

async function upsertSiloSuppression(db: PrismaClient, candidateId: string, email: string, level: SuppressionLevel, reason: string, source: string) {
  const existing = await db.siloSuppression.findUnique({ where: { candidateId_email: { candidateId, email } } });
  const merged = mergeLevel(existing?.level, level);
  await db.siloSuppression.upsert({
    where: { candidateId_email: { candidateId, email } },
    create: { candidateId, email, level, reason, source },
    update: { level: merged, ...(merged !== existing?.level ? { reason } : {}) },
  });
}

async function upsertGlobalSuppression(db: PrismaClient, agencyId: string, email: string, level: SuppressionLevel, reason: string, source: string) {
  const existing = await db.globalSuppression.findUnique({ where: { email } });
  const merged = mergeLevel(existing?.level, level);
  await db.globalSuppression.upsert({
    where: { email },
    create: { agencyId, email, level, reason, source },
    update: { level: merged, ...(merged !== existing?.level ? { reason } : {}) },
  });
}

export async function applyResendEvent(db: PrismaClient, svixId: string, event: ResendEvent) {
  const plans = planForEvent(event);
  const applied: Array<{ email: string; type: string; duplicate: boolean; suppressed: boolean }> = [];
  for (const plan of plans) {
    const dispatch = plan.providerMessageId
      ? await db.dispatchRecord.findFirst({ where: { providerMessageId: plan.providerMessageId, recipientEmail: plan.email }, include: { candidate: true } })
      : null;
    const agencyId = dispatch?.candidate.agencyId ?? (await db.agency.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id;
    try {
      await db.subscriberActivity.create({
        data: {
          candidateId: dispatch?.candidateId ?? null,
          subscriberId: dispatch?.subscriberId ?? null,
          email: plan.email,
          type: plan.type,
          providerEventId: `${svixId}:${plan.email}`,
          providerMessageId: plan.providerMessageId,
          payload: event as unknown as Prisma.InputJsonValue,
          occurredAt: plan.occurredAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        applied.push({ email: plan.email, type: plan.type, duplicate: true, suppressed: false });
        continue; // already processed: webhook retries are idempotent
      }
      throw error;
    }
    if (plan.suppression) {
      if (dispatch) await upsertSiloSuppression(db, dispatch.candidateId, plan.email, plan.suppression.level, plan.suppression.reason, 'resend-webhook');
      if (agencyId) await upsertGlobalSuppression(db, agencyId, plan.email, plan.suppression.level, plan.suppression.reason, 'resend-webhook');
    }
    applied.push({ email: plan.email, type: plan.type, duplicate: false, suppressed: Boolean(plan.suppression) });
  }
  return applied;
}

// One-click unsubscribe is silo-scoped: leaving one candidate's list is not leaving every
// candidate's. Bulk only — event invitations and personal contact are separate decisions.
export async function applyUnsubscribe(db: PrismaClient, token: string, siloSlug: string | null, secret: string) {
  const verified = await verifyUnsubscribeToken(token, secret);
  if (!verified) return { ok: false as const, reason: 'invalid or expired link' };
  const subscriber = await db.subscriber.findFirst({ where: { id: verified.subscriberId, candidateId: verified.siloId }, include: { candidate: true } });
  if (!subscriber) return { ok: false as const, reason: 'unknown subscriber' };
  if (siloSlug && subscriber.candidate.slug !== siloSlug) return { ok: false as const, reason: 'link does not match this list' };
  await upsertSiloSuppression(db, subscriber.candidateId, subscriber.email, 'BULK_ONLY', 'one-click unsubscribe', 'unsubscribe-link');
  await db.subscriberActivity.create({
    data: { candidateId: subscriber.candidateId, subscriberId: subscriber.id, email: subscriber.email, type: 'UNSUBSCRIBED', payload: { via: 'one-click' } },
  });
  return { ok: true as const, candidateName: subscriber.candidate.candidateName ?? subscriber.candidate.name };
}
