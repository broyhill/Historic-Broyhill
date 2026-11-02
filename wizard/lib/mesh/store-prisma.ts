// Prisma-backed MeshStore. Every query carries candidateId — a signal, route, or proposal
// can never name another silo.

import type { FunnelAction, PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../identity';
import type { FeederActivity, FeederVerdict, PropensityGoal } from '../feeder/nova';
import type { MeshSignal, NewSignal } from './orchestrator';
import type { MeshStore, SignalRouteRecord } from './store';

export class PrismaMeshStore implements MeshStore {
  constructor(private readonly db: PrismaClient) {}

  async recordSignal(candidateId: string, signal: NewSignal): Promise<string> {
    const row = await this.db.ecosystemSignal.create({
      data: {
        candidateId,
        ecosystemKey: signal.ecosystemKey,
        type: signal.type,
        payload: signal.payload as never,
        occurredAt: signal.occurredAt ?? new Date(),
      },
      select: { id: true },
    });
    return row.id;
  }

  async pendingSignals(candidateId: string): Promise<MeshSignal[]> {
    const rows = await this.db.ecosystemSignal.findMany({
      where: { candidateId, consumedAt: null },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      ecosystemKey: r.ecosystemKey,
      type: r.type,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      occurredAt: r.occurredAt,
    }));
  }

  async signalRoutes(candidateId: string): Promise<SignalRouteRecord[]> {
    const rows = await this.db.signalRoute.findMany({ where: { candidateId } });
    return rows.map((r) => ({
      id: r.id, candidateId: r.candidateId, ecosystemKey: r.ecosystemKey,
      signalType: r.signalType, recipeKey: r.recipeKey, goal: r.goal, enabled: r.enabled,
    }));
  }

  async upsertSignalRoute(route: Omit<SignalRouteRecord, 'id'>): Promise<string> {
    const row = await this.db.signalRoute.upsert({
      where: {
        candidateId_ecosystemKey_signalType_recipeKey: {
          candidateId: route.candidateId,
          ecosystemKey: route.ecosystemKey,
          signalType: route.signalType,
          recipeKey: route.recipeKey,
        },
      },
      create: route,
      update: { goal: route.goal, enabled: route.enabled },
      select: { id: true },
    });
    return row.id;
  }

  async markSignalConsumed(signalId: string, at: Date): Promise<void> {
    await this.db.ecosystemSignal.updateMany({ where: { id: signalId, consumedAt: null }, data: { consumedAt: at } });
  }

  async subscriberActivity(candidateId: string, subscriberIds: string[]): Promise<Map<string, FeederActivity[]>> {
    const map = new Map<string, FeederActivity[]>();
    if (!subscriberIds.length) return map;
    const rows = await this.db.subscriberActivity.findMany({
      where: { candidateId, subscriberId: { in: subscriberIds } },
      orderBy: { occurredAt: 'asc' },
      select: { subscriberId: true, type: true, occurredAt: true },
    });
    for (const row of rows) {
      if (!row.subscriberId) continue;
      const list = map.get(row.subscriberId) ?? [];
      list.push({ type: row.type, occurredAt: row.occurredAt });
      map.set(row.subscriberId, list);
    }
    return map;
  }

  async recordFeederVerdict(
    candidateId: string,
    subscriberId: string,
    verdict: FeederVerdict,
    slices: Partial<Record<PropensityGoal, string>>,
    journeyId?: string,
  ): Promise<void> {
    const now = new Date();
    const subscriber = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { affinityLabel: true } });
    if (!subscriber) return; // never write across the silo boundary

    for (const goal of ['HighValueConversionPropensity', 'ChurnRiskPropensity'] as const) {
      await this.db.subscriberPropensity.upsert({
        where: { candidateId_subscriberId_goal: { candidateId, subscriberId, goal } },
        create: { candidateId, subscriberId, goal, score: verdict.scores[goal], slice: slices[goal] ?? null },
        update: { score: verdict.scores[goal], slice: slices[goal] ?? null, scoredAt: now },
      });
    }

    await this.db.subscriber.update({
      where: { id: subscriberId },
      data: {
        affinityLabel: verdict.affinity,
        affinityScoredAt: now,
        sendTimeOptimalHour: verdict.sendTimeOptimalHour,
        frequencyCapPerWeek: verdict.frequencyCapPerWeek,
      },
    });

    const labelMoved = subscriber.affinityLabel !== verdict.affinity;
    const demandsAction = verdict.action !== 'NURTURE';
    if (!labelMoved && !demandsAction) return;
    await this.createProposal(candidateId, subscriberId, verdict.action, verdict.reason, journeyId, verdict.tone);
  }

  async cohortScores(candidateId: string, goal: PropensityGoal): Promise<number[]> {
    const rows = await this.db.subscriberPropensity.findMany({ where: { candidateId, goal }, select: { score: true } });
    return rows.map((r) => r.score);
  }

  async createProposal(candidateId: string, subscriberId: string | null, action: string, reason: string, journeyId?: string, tone?: string): Promise<boolean> {
    const pending = await this.db.funnelProposal.findFirst({
      where: { candidateId, subscriberId, action: action as FunnelAction, reason, status: 'PENDING_APPROVAL' },
      select: { id: true },
    });
    if (pending) return false;
    await this.db.funnelProposal.create({
      data: { candidateId, subscriberId, action: action as FunnelAction, reason, journeyId: journeyId ?? null, tone: tone ?? null },
    });
    return true;
  }

  async findSubscriberByEmail(candidateId: string, email: string): Promise<string | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const row = await this.db.subscriber.findFirst({ where: { candidateId, email: normalized }, select: { id: true } });
    return row?.id ?? null;
  }

  async recordActivity(candidateId: string, subscriberId: string, type: FeederActivity['type'], occurredAt: Date): Promise<void> {
    const sub = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { email: true } });
    if (!sub) return; // never write across the silo boundary
    await this.db.subscriberActivity.create({ data: { candidateId, subscriberId, email: sub.email, type, occurredAt } });
  }

  async enrichSubscriber(candidateId: string, subscriberId: string, fields: { phone?: string; company?: string; firstName?: string; lastName?: string; attributes?: Record<string, string> }): Promise<boolean> {
    const data: Record<string, unknown> = {};
    if (fields.phone) data.phone = fields.phone;
    if (fields.firstName) data.firstName = fields.firstName;
    if (fields.lastName) data.lastName = fields.lastName;
    const extras: Record<string, string> = { ...(fields.attributes ?? {}) };
    if (fields.company) extras.company = fields.company;
    if (Object.keys(extras).length) {
      const current = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { attributes: true } });
      data.attributes = { ...((current?.attributes as Record<string, unknown>) ?? {}), ...extras };
    }
    if (!Object.keys(data).length) return true;
    const res = await this.db.subscriber.updateMany({ where: { id: subscriberId, candidateId }, data });
    return res.count > 0;
  }

  async subscriberFields(candidateId: string, subscriberId: string): Promise<{ firstName?: string; lastName?: string; company?: string } | null> {
    const row = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { firstName: true, lastName: true, attributes: true } });
    if (!row) return null;
    const attrs = (row.attributes ?? {}) as Record<string, unknown>;
    return {
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      company: typeof attrs.company === 'string' ? attrs.company : undefined,
    };
  }

  async siloSubscriberIds(candidateId: string): Promise<string[]> {
    const rows = await this.db.subscriber.findMany({ where: { candidateId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async enrollInJourney(candidateId: string, journeyId: string, subscriberId: string): Promise<string> {
    const journey = await this.db.automatedJourney.findFirst({ where: { id: journeyId, candidateId }, select: { id: true } });
    if (!journey) return 'unknown-journey';
    const sub = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { id: true } });
    if (!sub) return 'unknown-subscriber';
    const existing = await this.db.journeyRun.findFirst({ where: { journeyId, subscriberId }, select: { id: true } });
    if (existing) return 'already-enrolled';
    await this.db.journeyRun.create({ data: { journeyId, candidateId, subscriberId } });
    return 'enrolled';
  }

  async isListMember(candidateId: string, listId: string, subscriberId: string): Promise<boolean> {
    const member = await this.db.subscriberListMember.findFirst({
      where: { listId, subscriberId, list: { candidateId }, subscriber: { candidateId } },
      select: { listId: true },
    });
    return member !== null;
  }
}
