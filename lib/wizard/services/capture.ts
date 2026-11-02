// Omnichannel intake (Weapons 1–3): NFC tap, QR placard/signage, web form, manual entry.
// Identity is exact: (silo, normalized email). A capture never sets RNC_RegID — a form is not an
// authoritative source — so every captured subscriber starts HELD_MISSING_EVIDENCE and cannot be
// sent to until an authoritative bridge supplies the exact RegID (exit gate).

import type { CaptureMethod, Prisma, PrismaClient } from '@generated/wizard-prisma';
import { normalizeEmail } from '../identity';
import { advance, newRun, parseJourneyDefinition, shouldEnroll } from '../journeys/runner';
import type { ForgeComposer } from '../orchestration/forge';
import { applyEffects } from './staging';

export const CAPTURE_METHODS: readonly CaptureMethod[] = ['NFC_TAP', 'QR_PLACARD', 'QR_SIGNAGE', 'WEB_FORM', 'MANUAL'];

export class CaptureInputError extends Error {
  constructor(public readonly status: 400 | 404, message: string) {
    super(message);
    this.name = 'CaptureInputError';
  }
}

export interface CaptureInput {
  candidateSlug: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  venueInterest: string | null;
  captureMethod: CaptureMethod;
  vipScore: number;
  notes: string | null;
}

function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// `trusted` = authenticated with x-capture-secret (device/webhook). Untrusted public form posts
// may not set a VIP score and may only use the public capture methods.
export function parseCaptureInput(body: unknown, trusted: boolean): CaptureInput {
  if (!body || typeof body !== 'object') throw new CaptureInputError(400, 'Body must be a JSON object');
  const raw = body as Record<string, unknown>;
  const candidateSlug = str(raw.candidateSlug, 64)?.toLowerCase();
  if (!candidateSlug) throw new CaptureInputError(400, 'candidateSlug is required');
  const email = normalizeEmail(raw.email);
  if (!email) throw new CaptureInputError(400, 'A valid email is required');
  const method = (str(raw.captureMethod, 20) ?? 'WEB_FORM').toUpperCase() as CaptureMethod;
  if (!CAPTURE_METHODS.includes(method)) throw new CaptureInputError(400, `captureMethod must be one of ${CAPTURE_METHODS.join(', ')}`);
  if (!trusted && (method === 'NFC_TAP' || method === 'MANUAL')) throw new CaptureInputError(400, `${method} captures require the capture secret`);
  let vipScore = 0;
  if (trusted && raw.vipScore !== undefined) {
    const n = Number(raw.vipScore);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new CaptureInputError(400, 'vipScore must be an integer 0-100');
    vipScore = n;
  }
  return {
    candidateSlug,
    email,
    firstName: str(raw.firstName, 80),
    lastName: str(raw.lastName, 80),
    phone: str(raw.phone, 32),
    venueInterest: str(raw.roomInterest ?? raw.venueInterest, 120),
    captureMethod: method,
    vipScore,
    notes: str(raw.notes, 2000),
  };
}

export interface CaptureResult {
  subscriberId: string;
  leadId: string;
  identityState: string;
  enrolledJourneyIds: string[];
  stagedCampaignIds: string[];
}

export async function processCapture(db: PrismaClient, input: CaptureInput, composer: ForgeComposer, now = new Date()): Promise<CaptureResult> {
  const silo = await db.candidateSilo.findUnique({ where: { slug: input.candidateSlug } });
  if (!silo) throw new CaptureInputError(404, 'Unknown candidate');

  const subscriber = await db.subscriber.upsert({
    where: { candidateId_email: { candidateId: silo.id, email: input.email } },
    create: {
      candidateId: silo.id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      venueInterest: input.venueInterest,
      vipScore: input.vipScore,
      identityState: 'HELD_MISSING_EVIDENCE',
      consentSource: `capture:${input.captureMethod}`,
    },
    update: {
      // Only fill blanks and raise the score; never overwrite identity evidence.
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.venueInterest ? { venueInterest: input.venueInterest } : {}),
    },
  });
  const finalSubscriber = input.vipScore > subscriber.vipScore
    ? await db.subscriber.update({ where: { id: subscriber.id }, data: { vipScore: input.vipScore } })
    : subscriber;

  const name = [input.firstName, input.lastName].filter(Boolean).join(' ') || null;
  const lead = await db.leadProfile.upsert({
    where: { candidateId_email: { candidateId: silo.id, email: input.email } },
    create: {
      candidateId: silo.id, subscriberId: finalSubscriber.id, email: input.email, name, phone: input.phone,
      leadScore: finalSubscriber.vipScore, captureMethod: input.captureMethod, venueInterest: input.venueInterest, notes: input.notes,
    },
    update: { subscriberId: finalSubscriber.id, leadScore: finalSubscriber.vipScore, ...(input.notes ? { notes: input.notes } : {}) },
  });

  await db.subscriberActivity.create({
    data: {
      candidateId: silo.id, subscriberId: finalSubscriber.id, email: input.email, type: 'CAPTURED',
      payload: { captureMethod: input.captureMethod, venueInterest: input.venueInterest } as Prisma.InputJsonValue, occurredAt: now,
    },
  });

  const enrolled: string[] = [];
  const staged: string[] = [];
  const journeys = await db.automatedJourney.findMany({ where: { candidateId: silo.id, active: true } });
  for (const journey of journeys) {
    const definition = parseJourneyDefinition(journey.definition);
    if (!shouldEnroll(definition, 'LEAD_CAPTURED', finalSubscriber)) continue;
    const existing = await db.journeyRun.findUnique({ where: { journeyId_subscriberId: { journeyId: journey.id, subscriberId: finalSubscriber.id } } });
    if (existing) continue; // exact re-capture does not re-enroll
    const facts = { vipScore: finalSubscriber.vipScore, phone: finalSubscriber.phone, engagedSince: () => false };
    const { run, effects } = advance(definition, newRun(), facts, now);
    const created = await db.journeyRun.create({
      data: {
        journeyId: journey.id, candidateId: silo.id, subscriberId: finalSubscriber.id,
        state: run.state, stepIndex: run.stepIndex, nextEvalAt: run.nextEvalAt, log: run.log as unknown as Prisma.InputJsonValue,
      },
    });
    enrolled.push(journey.id);
    staged.push(...(await applyEffects(db, silo, finalSubscriber, effects, composer, created.id)));
  }
  return { subscriberId: finalSubscriber.id, leadId: lead.id, identityState: finalSubscriber.identityState, enrolledJourneyIds: enrolled, stagedCampaignIds: staged };
}
