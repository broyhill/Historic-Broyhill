// Persistence boundary for the mesh. Lives alongside DispatchStore — the Prisma
// implementation reuses the same client; the memory implementation shares MemoryState
// so dispatch tests can drive the bus without a database.

import type { FeederActivity, FeederVerdict, PropensityGoal } from '../feeder/nova';
import type { MeshSignal, NewSignal } from './orchestrator';

export interface SignalRouteRecord {
  id: string;
  candidateId: string;
  ecosystemKey: string;
  signalType: string;
  recipeKey: string;
  goal: string | null;
  enabled: boolean;
}

export interface MeshStore {
  // Append a signal to the silo's bus. Returns the signal id.
  recordSignal(candidateId: string, signal: NewSignal): Promise<string>;
  // Unconsumed signals for this silo, oldest first.
  pendingSignals(candidateId: string): Promise<MeshSignal[]>;
  // The silo's route table.
  signalRoutes(candidateId: string): Promise<SignalRouteRecord[]>;
  // Define or replace a route (idempotent per its unique key).
  upsertSignalRoute(route: Omit<SignalRouteRecord, 'id'>): Promise<string>;
  // Stamp a signal consumed — it will never be delivered twice.
  markSignalConsumed(signalId: string, at: Date): Promise<void>;

  // Shared with the feeder path — same contract as DispatchStore.
  subscriberActivity(candidateId: string, subscriberIds: string[]): Promise<Map<string, FeederActivity[]>>;
  recordFeederVerdict(
    candidateId: string,
    subscriberId: string,
    verdict: FeederVerdict,
    slices: Partial<Record<PropensityGoal, string>>,
    journeyId?: string,
  ): Promise<void>;
  // Existing propensity scores for a goal across the silo — the cohort for slicing.
  cohortScores(candidateId: string, goal: PropensityGoal): Promise<number[]>;
  // File a deduped PENDING_APPROVAL proposal. Returns false when an identical pending
  // proposal already exists (advice is idempotent — it never piles up).
  createProposal(candidateId: string, subscriberId: string | null, action: string, reason: string, journeyId?: string, tone?: string): Promise<boolean>;

  // Perspective.io ingest: resolve a contact to this silo's subscriber by email
  // (normalized), or append an activity event for a known subscriber id.
  findSubscriberByEmail(candidateId: string, email: string): Promise<string | null>;
  recordActivity(candidateId: string, subscriberId: string, type: FeederActivity['type'], occurredAt: Date): Promise<void>;

  // Breeze data-agent enrichment: stamp recovered contact fields onto the silo's
  // own subscriber row (company, phone, name parts — never another silo's).
  enrichSubscriber(candidateId: string, subscriberId: string, fields: { phone?: string; company?: string; firstName?: string; lastName?: string; attributes?: Record<string, string> }): Promise<boolean>;

  // Draft personalization + insights: a subscriber's merged fields, and the
  // silo's subscriber id list — both silo-scoped reads.
  subscriberFields(candidateId: string, subscriberId: string): Promise<{ firstName?: string; lastName?: string; company?: string } | null>;
  siloSubscriberIds(candidateId: string): Promise<string[]>;

  // Workflow enrollment (HubSpot "enroll contacts in campaigns triggered by
  // actions"): put the silo's own subscriber into a journey run. Returns
  // 'enrolled' | 'already-enrolled' | 'unknown-journey' | 'unknown-subscriber'.
  enrollInJourney(candidateId: string, journeyId: string, subscriberId: string): Promise<string>;

  // Gated content (Content Hub member groups): is this silo's subscriber on
  // the named list? Silo-scoped read — list ids are per-silo.
  isListMember(candidateId: string, listId: string, subscriberId: string): Promise<boolean>;
}
