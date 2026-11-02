// In-memory MeshStore for tests. Shares MemoryState with the dispatch store so a test
// can seed subscribers/activities once and drive the bus with no database.

import type { FeederActivity, FeederVerdict, PropensityGoal } from '../feeder/nova';
import type { MemoryState } from '../dispatch/store-memory';
import type { MeshSignal, NewSignal } from './orchestrator';
import type { MeshStore, SignalRouteRecord } from './store';

let nextId = 1;

export class MemoryMeshStore implements MeshStore {
  constructor(private readonly state: MemoryState) {}

  async recordSignal(candidateId: string, signal: NewSignal): Promise<string> {
    const id = `sig-${nextId++}`;
    this.state.signals.push({
      id, candidateId, ecosystemKey: signal.ecosystemKey, type: signal.type,
      payload: signal.payload, occurredAt: signal.occurredAt ?? new Date(), consumedAt: null,
    });
    return id;
  }

  async pendingSignals(candidateId: string): Promise<MeshSignal[]> {
    return this.state.signals
      .filter((s) => s.candidateId === candidateId && s.consumedAt === null)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((s) => ({ id: s.id, ecosystemKey: s.ecosystemKey, type: s.type, payload: s.payload, occurredAt: s.occurredAt }));
  }

  async signalRoutes(candidateId: string): Promise<SignalRouteRecord[]> {
    return this.state.signalRoutes.filter((r) => r.candidateId === candidateId);
  }

  async upsertSignalRoute(route: Omit<SignalRouteRecord, 'id'>): Promise<string> {
    const existing = this.state.signalRoutes.find(
      (r) => r.candidateId === route.candidateId && r.ecosystemKey === route.ecosystemKey && r.signalType === route.signalType && r.recipeKey === route.recipeKey,
    );
    if (existing) {
      existing.goal = route.goal;
      existing.enabled = route.enabled;
      return existing.id;
    }
    const id = `route-${nextId++}`;
    this.state.signalRoutes.push({ id, ...route });
    return id;
  }

  async markSignalConsumed(signalId: string, at: Date): Promise<void> {
    const signal = this.state.signals.find((s) => s.id === signalId);
    if (signal && signal.consumedAt === null) signal.consumedAt = at;
  }

  async subscriberActivity(candidateId: string, subscriberIds: string[]): Promise<Map<string, FeederActivity[]>> {
    const map = new Map<string, FeederActivity[]>();
    const wanted = new Set(subscriberIds);
    for (const a of this.state.activities) {
      if (a.candidateId !== candidateId || !wanted.has(a.subscriberId)) continue;
      const list = map.get(a.subscriberId) ?? [];
      list.push({ type: a.type, occurredAt: a.occurredAt });
      map.set(a.subscriberId, list);
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
    if (!this.state.subscribers.some((s) => s.candidateId === candidateId && s.subscriberId === subscriberId)) return;
    this.state.feederVerdicts.push({ candidateId, subscriberId, verdict, slices, journeyId });
    // Track the cohort score so slices rank against real stored propensities.
    const key = `${subscriberId}:HighValueConversionPropensity`;
    this.state.propensityScores[key] = verdict.scores.HighValueConversionPropensity;
    const prior = this.state.subscriberAffinity[subscriberId] ?? 'UNSCORED';
    const labelMoved = prior !== verdict.affinity;
    this.state.subscriberAffinity[subscriberId] = verdict.affinity;
    const demandsAction = verdict.action !== 'NURTURE';
    if (!labelMoved && !demandsAction) return;
    await this.createProposal(candidateId, subscriberId, verdict.action, verdict.reason, journeyId, verdict.tone);
  }

  async cohortScores(candidateId: string, _goal: PropensityGoal): Promise<number[]> {
    const inSilo = new Set(this.state.subscribers.filter((s) => s.candidateId === candidateId).map((s) => s.subscriberId));
    return Object.entries(this.state.propensityScores)
      .filter(([key]) => inSilo.has(key.split(':')[0] ?? ''))
      .map(([, score]) => score);
  }

  async createProposal(candidateId: string, subscriberId: string | null, action: string, reason: string, _journeyId?: string, tone?: string): Promise<boolean> {
    const pending = this.state.feederProposals.some(
      (p) => p.candidateId === candidateId && p.subscriberId === subscriberId && p.action === action && p.reason === reason && p.status === 'PENDING_APPROVAL',
    );
    if (pending) return false;
    this.state.feederProposals.push({ candidateId, subscriberId, action: action as never, reason, status: 'PENDING_APPROVAL', tone: tone ?? null });
    return true;
  }

  async findSubscriberByEmail(candidateId: string, email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    const sub = this.state.subscribers.find((s) => s.candidateId === candidateId && s.email.trim().toLowerCase() === normalized);
    return sub?.subscriberId ?? null;
  }

  async recordActivity(candidateId: string, subscriberId: string, type: FeederActivity['type'], occurredAt: Date): Promise<void> {
    this.state.activities.push({ candidateId, subscriberId, type, occurredAt });
  }

  async enrichSubscriber(candidateId: string, subscriberId: string, fields: { phone?: string; company?: string; firstName?: string; lastName?: string; attributes?: Record<string, string> }): Promise<boolean> {
    const sub = this.state.subscribers.find((s) => s.candidateId === candidateId && s.subscriberId === subscriberId);
    if (!sub) return false;
    const { attributes, ...flat } = fields;
    sub.enrichment = { ...(sub.enrichment ?? {}), ...flat, ...(attributes ?? {}) };
    if (fields.phone) sub.phone = fields.phone;
    if (fields.firstName) sub.firstName = fields.firstName;
    if (fields.lastName) sub.lastName = fields.lastName;
    return true;
  }

  async subscriberFields(candidateId: string, subscriberId: string): Promise<{ firstName?: string; lastName?: string; company?: string } | null> {
    const sub = this.state.subscribers.find((s) => s.candidateId === candidateId && s.subscriberId === subscriberId);
    if (!sub) return null;
    return {
      firstName: sub.firstName ?? undefined,
      lastName: sub.lastName ?? undefined,
      company: sub.enrichment?.company,
    };
  }

  async siloSubscriberIds(candidateId: string): Promise<string[]> {
    return this.state.subscribers.filter((s) => s.candidateId === candidateId).map((s) => s.subscriberId);
  }

  async enrollInJourney(candidateId: string, journeyId: string, subscriberId: string): Promise<string> {
    const journey = this.state.journeys.find((j) => j.id === journeyId && j.candidateId === candidateId);
    if (!journey) return 'unknown-journey';
    const sub = this.state.subscribers.find((s) => s.candidateId === candidateId && s.subscriberId === subscriberId);
    if (!sub) return 'unknown-subscriber';
    if (this.state.journeyRuns.some((r) => r.journeyId === journeyId && r.subscriberId === subscriberId)) return 'already-enrolled';
    this.state.journeyRuns.push({ journeyId, candidateId, subscriberId });
    return 'enrolled';
  }

  async isListMember(candidateId: string, listId: string, subscriberId: string): Promise<boolean> {
    const sub = this.state.subscribers.find((s) => s.candidateId === candidateId && s.subscriberId === subscriberId);
    if (!sub) return false;
    return this.state.listMembers.some((m) => m.listId === listId && m.subscriberId === subscriberId);
  }
}
