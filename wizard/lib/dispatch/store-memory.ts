// In-memory DispatchStore for tests and proofs. Same contract as the Prisma store, including
// silo isolation and idempotent record writes, with no database anywhere.

import type { SuppressionRow } from '../compliance/suppression';
import type { FeederActivity, FeederVerdict, PropensityGoal } from '../feeder/nova';
import { normalizeEmail } from '../identity';
import { matchesSegment, type SegmentRules } from '../segments';
import type { AuthorizationRecord, DelegationRecord } from './gates';
import type {
  DispatchCampaign,
  DispatchContext,
  DispatchRecipient,
  DispatchSilo,
  DispatchStore,
  DispatchVariant,
  NewDispatchRecord,
} from './store';

export interface MemorySubscriber extends DispatchRecipient {
  candidateId: string;
  vipScore: number;
  phone: string | null;
  identityState: 'HELD_MISSING_EVIDENCE' | 'RNC_REGID_EXACT';
  enrichment?: Record<string, string>;
}

export interface MemoryState {
  silos: DispatchSilo[];
  campaigns: DispatchCampaign[];
  variants: Array<DispatchVariant & { campaignId: string }>;
  authorizations: Array<AuthorizationRecord & { variantId: string }>;
  delegations: Array<DelegationRecord & { candidateId: string }>;
  subscribers: MemorySubscriber[];
  listMembers: Array<{ listId: string; subscriberId: string }>;
  segments: Array<{ id: string; candidateId: string; rules: SegmentRules }>;
  siloSuppressions: Array<{ candidateId: string; email: string; level: 'BULK_ONLY' | 'ALL_EMAIL'; reason: string }>;
  globalSuppressions: Array<{ agencyId: string; email: string; level: 'BULK_ONLY' | 'ALL_EMAIL'; reason: string }>;
  killSwitch: Record<string, boolean>;
  dispatches: NewDispatchRecord[];
  activities: Array<{ candidateId: string; subscriberId: string; type: FeederActivity['type']; occurredAt: Date }>;
  feederVerdicts: Array<{ candidateId: string; subscriberId: string; verdict: FeederVerdict; slices: Partial<Record<PropensityGoal, string>>; journeyId?: string }>;
  feederProposals: Array<{ candidateId: string; subscriberId: string | null; action: FeederVerdict['action']; reason: string; status: 'PENDING_APPROVAL' | 'ACCEPTED' | 'DISMISSED'; tone?: string | null }>;
  subscriberAffinity: Record<string, FeederVerdict['affinity']>;
  // Mesh (orchestrator) state
  signals: Array<{ id: string; candidateId: string; ecosystemKey: string; type: string; payload: Record<string, unknown>; occurredAt: Date; consumedAt: Date | null }>;
  signalRoutes: Array<{ id: string; candidateId: string; ecosystemKey: string; signalType: string; recipeKey: string; goal: string | null; enabled: boolean }>;
  propensityScores: Record<string, number>; // `${subscriberId}:${goal}` → latest score
  journeys: Array<{ id: string; candidateId: string; name: string }>;
  journeyRuns: Array<{ journeyId: string; candidateId: string; subscriberId: string }>;
}

export function emptyState(): MemoryState {
  return { silos: [], campaigns: [], variants: [], authorizations: [], delegations: [], subscribers: [], listMembers: [], segments: [], siloSuppressions: [], globalSuppressions: [], killSwitch: {}, dispatches: [], activities: [], feederVerdicts: [], feederProposals: [], subscriberAffinity: {}, signals: [], signalRoutes: [], propensityScores: {}, journeys: [], journeyRuns: [] };
}

export class MemoryDispatchStore implements DispatchStore {
  constructor(public readonly state: MemoryState) {}

  async loadContext(candidateId: string, campaignId: string): Promise<DispatchContext | null> {
    const campaign = this.state.campaigns.find((c) => c.id === campaignId && c.candidateId === candidateId);
    const silo = campaign && this.state.silos.find((s) => s.id === candidateId);
    if (!campaign || !silo) return null;
    const variants = this.state.variants.filter((v) => v.campaignId === campaignId).sort((a, b) => b.version - a.version);
    const variant = variants[0] ?? null;
    const authorizations = variant ? this.state.authorizations.filter((a) => a.variantId === variant.id) : [];
    const delegations = this.state.delegations.filter((d) => d.candidateId === candidateId);
    return { silo, campaign, variant, authorizations, delegations };
  }

  async recipients(context: DispatchContext): Promise<DispatchRecipient[]> {
    const { campaign } = context;
    const inSilo = this.state.subscribers.filter((s) => s.candidateId === campaign.candidateId);
    if (campaign.recipientSubscriberId) return inSilo.filter((s) => s.subscriberId === campaign.recipientSubscriberId);
    if (campaign.audienceListId) {
      const ids = new Set(this.state.listMembers.filter((m) => m.listId === campaign.audienceListId).map((m) => m.subscriberId));
      return inSilo.filter((s) => ids.has(s.subscriberId));
    }
    if (campaign.audienceSegmentId) {
      const segment = this.state.segments.find((s) => s.id === campaign.audienceSegmentId && s.candidateId === campaign.candidateId);
      return segment ? inSilo.filter((s) => matchesSegment(s, segment.rules)) : [];
    }
    return [];
  }

  async suppressionRows(candidateId: string, agencyId: string, emails: string[]): Promise<SuppressionRow[]> {
    const wanted = new Set(emails.map((e) => normalizeEmail(e)).filter(Boolean));
    return [
      ...this.state.siloSuppressions
        .filter((s) => s.candidateId === candidateId && wanted.has(normalizeEmail(s.email)))
        .map((s) => ({ email: s.email, level: s.level, reason: s.reason, scope: 'SILO' as const })),
      ...this.state.globalSuppressions
        .filter((s) => s.agencyId === agencyId && wanted.has(normalizeEmail(s.email)))
        .map((s) => ({ email: s.email, level: s.level, reason: s.reason, scope: 'GLOBAL' as const })),
    ];
  }

  async killSwitchEngaged(agencyId: string): Promise<boolean> {
    return this.state.killSwitch[agencyId] ?? true; // absent = engaged (fail closed)
  }

  async freezeVariant(variantId: string, _reason: string, at: Date): Promise<void> {
    const variant = this.state.variants.find((v) => v.id === variantId);
    if (variant && !variant.frozenAt) variant.frozenAt = at;
  }

  async recordDispatch(record: NewDispatchRecord): Promise<{ created: boolean }> {
    if (this.state.dispatches.some((d) => d.idempotencyKey === record.idempotencyKey)) return { created: false };
    this.state.dispatches.push(record);
    return { created: true };
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
    const prior = this.state.subscriberAffinity[subscriberId] ?? 'UNSCORED';
    const labelMoved = prior !== verdict.affinity;
    this.state.subscriberAffinity[subscriberId] = verdict.affinity;
    const demandsAction = verdict.action !== 'NURTURE';
    if (!labelMoved && !demandsAction) return;
    const pending = this.state.feederProposals.some(
      (p) => p.candidateId === candidateId && p.subscriberId === subscriberId && p.action === verdict.action && p.status === 'PENDING_APPROVAL',
    );
    if (pending) return;
    this.state.feederProposals.push({ candidateId, subscriberId, action: verdict.action, reason: verdict.reason, status: 'PENDING_APPROVAL' });
  }
}
