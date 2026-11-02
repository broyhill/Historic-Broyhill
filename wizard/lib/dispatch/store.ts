// Persistence boundary for dispatch. Two implementations: Prisma (the app) and in-memory
// (tests and proofs, so every gate can be demonstrated without touching any database).

import type { Channel, DispatchMode, MessageClass, UserRole } from '@prisma/client';
import type { SuppressionRow } from '../compliance/suppression';
import type { FeederActivity, FeederVerdict } from '../feeder/nova';
import type { EmailBlock } from '../templates/blocks';
import type { AuthorizationRecord, DelegationRecord } from './gates';

export interface DispatchSilo {
  id: string;
  slug: string;
  agencyId: string;
  bgopCandidateId: string | null;
  candidateName: string | null;
  committeeId: string | null;
  officeSought: string | null;
  fromName: string;
  fromEmail: string;
  replyToEmail: string | null;
  physicalAddress: string;
  paidForBy: string | null;
}

export interface DispatchCampaign {
  id: string;
  candidateId: string;
  status: string;
  channel: Channel;
  messageClass: MessageClass;
  reviewedByRole: UserRole | null;
  audienceListId: string | null;
  audienceSegmentId: string | null;
  recipientSubscriberId: string | null;
  originAgentKey: string | null;
}

export interface DispatchVariant {
  id: string;
  version: number;
  subject: string;
  preheader: string | null;
  blocks: EmailBlock[];
  contentHash: string;
  frozenAt: Date | null;
}

export interface DispatchRecipient {
  subscriberId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  venueInterest: string | null;
  rncRegId: string | null;
}

export interface DispatchContext {
  silo: DispatchSilo;
  campaign: DispatchCampaign;
  variant: DispatchVariant | null;
  authorizations: AuthorizationRecord[];
  delegations: DelegationRecord[];
}

export interface NewDispatchRecord {
  candidateId: string;
  campaignId: string;
  variantId: string;
  subscriberId: string | null;
  recipientEmail: string;
  mode: DispatchMode;
  gateReport: unknown;
  idempotencyKey: string;
  renderedHash: string | null;
  providerMessageId: string | null;
}

export interface DispatchStore {
  // Loads the campaign only if it belongs to candidateId (silo isolation).
  loadContext(candidateId: string, campaignId: string): Promise<DispatchContext | null>;
  // Expands the audience — always scoped to the campaign's silo.
  recipients(context: DispatchContext): Promise<DispatchRecipient[]>;
  // Silo + global agency suppression rows for these addresses.
  suppressionRows(candidateId: string, agencyId: string, emails: string[]): Promise<SuppressionRow[]>;
  killSwitchEngaged(agencyId: string): Promise<boolean>;
  freezeVariant(variantId: string, reason: string, at: Date): Promise<void>;
  // Idempotent on idempotencyKey: a repeat returns created=false and writes nothing.
  recordDispatch(record: NewDispatchRecord): Promise<{ created: boolean }>;

  // AI funnel feeder: the silo's recent SubscriberActivity rows per subscriber id.
  // Only this silo's rows are returned — cross-silo reads are impossible by contract.
  subscriberActivity(candidateId: string, subscriberIds: string[]): Promise<Map<string, FeederActivity[]>>;
  // Persists one feeder verdict: upserts the per-goal SubscriberPropensity rows
  // (with cohort slices), stamps the Subscriber's affinity + Nova decisioning fields,
  // and files a FunnelProposal (PENDING_APPROVAL) when the label moved or suppression
  // is recommended. Proposals are advice for a human, never self-executing.
  recordFeederVerdict(candidateId: string, subscriberId: string, verdict: FeederVerdict, slices: Partial<Record<'HighValueConversionPropensity' | 'ChurnRiskPropensity', string>>, journeyId?: string): Promise<void>;
}
