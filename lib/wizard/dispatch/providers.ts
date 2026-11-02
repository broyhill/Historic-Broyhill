// External gates the agency layer consults but does not own. Each has an "unbound" default that
// refuses, so nothing can go LIVE until a real, authorized adapter is wired in.
//   E20 GO        → brain.decisions decision_result='go' (score ≥ 70) for this exact content hash
//   E10 clearance → e10.check_clearance_batch(...) CLEAR row in e10.clearance_log before any send
// E20_GO is not consent (Eight Houses, House 1): it never substitutes for Wizard authorization.

import type { Channel } from '@generated/wizard-prisma';

export interface ProviderVerdict {
  granted: boolean;
  reference?: string; // decision_id / clearance_id when bound
  detail: string;
}

export interface GateRequest {
  candidateId: string;
  bgopCandidateId: string | null;
  campaignId: string;
  variantId: string;
  contentHash: string;
  channel: Channel;
}

export interface E20GoProvider {
  readonly name: string;
  check(request: GateRequest): Promise<ProviderVerdict>;
}

export interface E10ClearanceProvider {
  readonly name: string;
  check(request: GateRequest): Promise<ProviderVerdict>;
}

export const unboundE20Go: E20GoProvider = {
  name: 'E20 Brain GO — adapter not bound',
  check: async () => ({
    granted: false,
    detail: 'No E20 adapter is bound. E20 has never adjudicated a Wizard step (wizard_completeness 2026-10-03); no brain.decisions row exists for this hash.',
  }),
};

export const unboundE10Clearance: E10ClearanceProvider = {
  name: 'E10 Compliance clearance — adapter not bound',
  check: async () => ({
    granted: false,
    detail: 'No E10 adapter is bound. e10.check_clearance_batch is keyed on cluster_id, not rnc_regid (Conflict C11); no clearance_log row exists for this send.',
  }),
};
