// Dynamic segmentation (Weapon 8). Rules are exact attribute filters only — no similarity, no
// propensity inference, no clustering. Evaluated in Prisma (where clause) and in memory alike.

import type { IdentityState, Prisma } from '@prisma/client';

export interface SegmentRules {
  minVipScore?: number;
  venueInterest?: string; // exact, case-insensitive
  identityState?: IdentityState;
  hasPhone?: boolean;
  activity?: { type: 'OPENED' | 'CLICKED' | 'CAPTURED'; sinceDays: number }; // behavioral, exact
}

export function parseSegmentRules(input: unknown): SegmentRules {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('rules must be an object');
  const raw = input as Record<string, unknown>;
  const rules: SegmentRules = {};
  if (raw.minVipScore !== undefined) {
    if (typeof raw.minVipScore !== 'number' || !Number.isInteger(raw.minVipScore)) throw new Error('minVipScore must be an integer');
    rules.minVipScore = raw.minVipScore;
  }
  if (raw.venueInterest !== undefined) {
    if (typeof raw.venueInterest !== 'string' || !raw.venueInterest.trim()) throw new Error('venueInterest must be a string');
    rules.venueInterest = raw.venueInterest.trim();
  }
  if (raw.identityState !== undefined) {
    if (raw.identityState !== 'HELD_MISSING_EVIDENCE' && raw.identityState !== 'RNC_REGID_EXACT') throw new Error('identityState is invalid');
    rules.identityState = raw.identityState;
  }
  if (raw.hasPhone !== undefined) {
    if (typeof raw.hasPhone !== 'boolean') throw new Error('hasPhone must be boolean');
    rules.hasPhone = raw.hasPhone;
  }
  if (raw.activity !== undefined) {
    const a = raw.activity as Record<string, unknown>;
    if (!a || !['OPENED', 'CLICKED', 'CAPTURED'].includes(String(a.type)) || typeof a.sinceDays !== 'number' || a.sinceDays <= 0) {
      throw new Error('activity must be { type: OPENED|CLICKED|CAPTURED, sinceDays > 0 }');
    }
    rules.activity = { type: a.type as 'OPENED' | 'CLICKED' | 'CAPTURED', sinceDays: a.sinceDays };
  }
  return rules;
}

export function segmentWhere(candidateId: string, rules: SegmentRules, now = new Date()): Prisma.SubscriberWhereInput {
  const where: Prisma.SubscriberWhereInput = { candidateId };
  if (rules.minVipScore !== undefined) where.vipScore = { gte: rules.minVipScore };
  if (rules.venueInterest) where.venueInterest = { equals: rules.venueInterest, mode: 'insensitive' };
  if (rules.identityState) where.identityState = rules.identityState;
  if (rules.hasPhone !== undefined) where.phone = rules.hasPhone ? { not: null } : null;
  if (rules.activity) {
    const since = new Date(now.getTime() - rules.activity.sinceDays * 86_400_000);
    where.activities = { some: { type: rules.activity.type, occurredAt: { gte: since }, candidateId } };
  }
  return where;
}

export interface SegmentSubject {
  vipScore: number;
  venueInterest: string | null;
  identityState: IdentityState;
  phone: string | null;
  activities?: Array<{ type: string; occurredAt: Date }>;
}

export function matchesSegment(subject: SegmentSubject, rules: SegmentRules, now = new Date()): boolean {
  if (rules.minVipScore !== undefined && subject.vipScore < rules.minVipScore) return false;
  if (rules.venueInterest && subject.venueInterest?.toLowerCase() !== rules.venueInterest.toLowerCase()) return false;
  if (rules.identityState && subject.identityState !== rules.identityState) return false;
  if (rules.hasPhone !== undefined && Boolean(subject.phone) !== rules.hasPhone) return false;
  if (rules.activity) {
    const since = now.getTime() - rules.activity.sinceDays * 86_400_000;
    if (!(subject.activities ?? []).some((a) => a.type === rules.activity!.type && a.occurredAt.getTime() >= since)) return false;
  }
  return true;
}
