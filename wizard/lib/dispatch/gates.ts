// The agency approval gate and the live-send gates, evaluated as one pure function so every
// decision is reproducible and testable. Nothing here can be bypassed by a caller: the courier
// sends LIVE only when evaluateCampaignGates() says so.
//
// DISPATCH tier — must pass to run even a dry-run:
//   AGENCY_APPROVAL   campaign PUBLISHED by AGENCY_ADMIN or CANDIDATE_MANAGER (spec Weapon 5)
//   CHANNEL_GOVERNED  channel is governed end to end here (only EMAIL / W01 today)
//   VARIANT_PRESENT   a compiled variant with a composition hash exists
//   AGENT_DELEGATION  if an AI agent originated the campaign (originAgentKey), a live
//                     AgentDelegation grants that agent the privilege for the action
//                     (D365-style: delegated role, never ownership; fails closed)
// LIVE tier — every one must pass, in production, for a single message to leave:
//   WIZARD_AUTHORIZATION  candidate principal typed the exact phrase over THIS content hash
//   E20_GO                Brain GO for this hash (unbound → refused)
//   E10_CLEARANCE         compliance clearance record (unbound → refused)
//   PLATFORM_SUPPRESSION  e30/brain suppression lists readable (unbound → refused)
//   KILL_SWITCH           agency master kill switch released
//   ED_LIVE_ORDER         Ed's explicit order naming this campaign and this exact hash
//   LIVE_RUNTIME          NODE_ENV=production and WIZARD_DISPATCH_MODE=LIVE
// Per-recipient gates (exit gate, suppression) are applied by the courier.

import type { Channel, MessageClass, UserRole } from '@prisma/client';
import { AUTHORIZATION_PHRASE } from '../config';
import { PUBLISHER_ROLES } from '../rbac';
import type { ProviderVerdict } from './providers';

export type GateId =
  | 'AGENCY_APPROVAL'
  | 'CHANNEL_GOVERNED'
  | 'VARIANT_PRESENT'
  | 'AGENT_DELEGATION'
  | 'WIZARD_AUTHORIZATION'
  | 'E20_GO'
  | 'E10_CLEARANCE'
  | 'PLATFORM_SUPPRESSION'
  | 'KILL_SWITCH'
  | 'ED_LIVE_ORDER'
  | 'LIVE_RUNTIME';

export interface GateResult {
  gate: GateId;
  tier: 'DISPATCH' | 'LIVE';
  pass: boolean;
  detail: string;
  reference?: string;
}

export interface AuthorizationRecord {
  id: string;
  contentHash: string;
  phrase: string;
  authorizedByPrincipal: boolean;
}

// A live AgentDelegation row for the silo: unexpired and unrevoked at evaluation time.
export interface DelegationRecord {
  id: string;
  agentKey: string;
  privileges: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
}

// Set when the campaign was originated by an AI agent, not a human user.
export interface AgentAction {
  agentKey: string;
  action: string; // privilege name, e.g. 'dispatch'
}

export interface CampaignGateInput {
  campaign: {
    id: string;
    status: string;
    channel: Channel;
    messageClass: MessageClass;
    reviewedByRole: UserRole | null;
  };
  variant: { id: string; contentHash: string } | null;
  authorizations: AuthorizationRecord[];
  channelGoverned: boolean;
  agentAction?: AgentAction;
  delegations?: DelegationRecord[];
  now?: Date;
  e20: ProviderVerdict;
  e10: ProviderVerdict;
  platformSuppressionAvailable: boolean;
  killSwitchEngaged: boolean;
  edLiveOrder: string | undefined;
  requestedMode: 'DRY_RUN' | 'LIVE';
}

export interface CampaignGateReport {
  gates: GateResult[];
  dispatchAllowed: boolean;
  liveAllowed: boolean;
  effectiveMode: 'BLOCKED' | 'DRY_RUN' | 'LIVE';
  failedLiveGates: GateId[];
}

export function matchingAuthorization(
  authorizations: AuthorizationRecord[],
  contentHash: string,
): AuthorizationRecord | undefined {
  return authorizations.find(
    (a) => a.contentHash === contentHash && a.phrase === AUTHORIZATION_PHRASE && a.authorizedByPrincipal,
  );
}

export function evaluateCampaignGates(input: CampaignGateInput): CampaignGateReport {
  const { campaign, variant } = input;
  const gates: GateResult[] = [];
  const add = (gate: GateId, tier: GateResult['tier'], pass: boolean, detail: string, reference?: string) =>
    gates.push({ gate, tier, pass, detail, ...(reference ? { reference } : {}) });

  const approved = campaign.status === 'PUBLISHED' && campaign.reviewedByRole !== null && PUBLISHER_ROLES.includes(campaign.reviewedByRole);
  add('AGENCY_APPROVAL', 'DISPATCH', approved,
    approved ? `PUBLISHED by ${campaign.reviewedByRole}` : `status ${campaign.status}; needs PUBLISHED by AGENCY_ADMIN or CANDIDATE_MANAGER`);
  add('CHANNEL_GOVERNED', 'DISPATCH', input.channelGoverned,
    input.channelGoverned ? `${campaign.channel} is governed end to end` : `${campaign.channel} is hooked only; no dispatch path in the agency layer`);
  add('VARIANT_PRESENT', 'DISPATCH', variant !== null,
    variant ? `variant ${variant.id} hash ${variant.contentHash.slice(0, 12)}…` : 'no compiled variant');

  // AGENT_DELEGATION: pass trivially for human-originated campaigns; for agent-originated
  // ones, a live delegation must grant this agent the action's privilege.
  const { agentAction } = input;
  if (!agentAction) {
    add('AGENT_DELEGATION', 'DISPATCH', true, 'human-originated campaign; no delegation required');
  } else {
    const now = input.now ?? new Date();
    const grant = (input.delegations ?? []).find(
      (d) => d.agentKey === agentAction.agentKey &&
        d.privileges.includes(agentAction.action) &&
        d.revokedAt === null &&
        (d.expiresAt === null || d.expiresAt > now),
    );
    add('AGENT_DELEGATION', 'DISPATCH', Boolean(grant),
      grant ? `agent '${agentAction.agentKey}' holds a live '${agentAction.action}' delegation`
        : `agent '${agentAction.agentKey}' has no live '${agentAction.action}' delegation for this silo`,
      grant?.id);
  }

  const auth = variant ? matchingAuthorization(input.authorizations, variant.contentHash) : undefined;
  add('WIZARD_AUTHORIZATION', 'LIVE', Boolean(auth),
    auth ? `candidate principal authorized this exact hash` : variant
      ? 'no candidate-principal authorization with the exact phrase for this content hash'
      : 'nothing to authorize', auth?.id);
  add('E20_GO', 'LIVE', input.e20.granted, input.e20.detail, input.e20.reference);
  add('E10_CLEARANCE', 'LIVE', input.e10.granted, input.e10.detail, input.e10.reference);
  add('PLATFORM_SUPPRESSION', 'LIVE', input.platformSuppressionAvailable,
    input.platformSuppressionAvailable ? 'platform suppression lists consulted' : 'platform suppression lists (e30/brain) not readable; cannot prove a recipient unsuppressed');
  add('KILL_SWITCH', 'LIVE', !input.killSwitchEngaged,
    input.killSwitchEngaged ? 'agency master kill switch is ENGAGED' : 'kill switch released');
  const expectedOrder = variant ? `${campaign.id}:${variant.contentHash}` : null;
  const ordered = expectedOrder !== null && input.edLiveOrder === expectedOrder;
  add('ED_LIVE_ORDER', 'LIVE', ordered,
    ordered ? "Ed's order names this campaign and hash" : input.edLiveOrder ? "Ed's order names a different campaign or hash" : "no order from Ed (WIZARD_ED_LIVE_ORDER unset)");
  add('LIVE_RUNTIME', 'LIVE', input.requestedMode === 'LIVE',
    input.requestedMode === 'LIVE' ? 'production runtime, LIVE requested' : 'dry-run runtime (development, or WIZARD_DISPATCH_MODE≠LIVE)');

  const dispatchAllowed = gates.filter((g) => g.tier === 'DISPATCH').every((g) => g.pass);
  const failedLiveGates = gates.filter((g) => g.tier === 'LIVE' && !g.pass).map((g) => g.gate);
  const liveAllowed = dispatchAllowed && failedLiveGates.length === 0;
  return {
    gates,
    dispatchAllowed,
    liveAllowed,
    effectiveMode: !dispatchAllowed ? 'BLOCKED' : liveAllowed ? 'LIVE' : 'DRY_RUN',
    failedLiveGates,
  };
}
