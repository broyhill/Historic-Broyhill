// Team permission matrix (Weapon 10). Roles are per silo; only AGENCY_ADMIN crosses silos.
// The Wizard's exact-version authorization is NOT a role permission: it belongs to the
// candidate principal (CandidateUser.isCandidatePrincipal) — see canAuthorizeWizard().

import type { UserRole } from '@generated/wizard-prisma';

export type Permission =
  | 'agency.overview'
  | 'silo.switch'
  | 'killswitch.write'
  | 'campaign.read'
  | 'campaign.draft'
  | 'campaign.submit'
  | 'campaign.publish'
  | 'campaign.dispatch'
  | 'template.read'
  | 'template.edit'
  | 'template.lock'
  | 'suppression.read'
  | 'suppression.write'
  | 'suppression.global.write'
  | 'telemetry.read'
  | 'lead.read'
  | 'journey.run';

const MATRIX: Record<UserRole, readonly Permission[]> = {
  AGENCY_ADMIN: [
    'agency.overview', 'silo.switch', 'killswitch.write',
    'campaign.read', 'campaign.draft', 'campaign.submit', 'campaign.publish', 'campaign.dispatch',
    'template.read', 'template.edit', 'template.lock',
    'suppression.read', 'suppression.write', 'suppression.global.write',
    'telemetry.read', 'lead.read', 'journey.run',
  ],
  CANDIDATE_MANAGER: [
    'campaign.read', 'campaign.draft', 'campaign.submit', 'campaign.publish', 'campaign.dispatch',
    'template.read', 'template.edit',
    'suppression.read', 'suppression.write',
    'telemetry.read', 'lead.read', 'journey.run',
  ],
  CAMPAIGN_DRAFTER: ['campaign.read', 'campaign.draft', 'campaign.submit', 'template.read', 'template.edit', 'lead.read'],
  COMPLIANCE_VIEWER: ['campaign.read', 'template.read', 'suppression.read', 'telemetry.read', 'lead.read'],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return MATRIX[role];
}

// Only the candidate himself types the Wizard authorization (Layer 1 / Composition Journey
// Step 9). A role, however senior, is not consent. Provisional — Conflict C3.
export function canAuthorizeWizard(user: { isCandidatePrincipal: boolean }): boolean {
  return user.isCandidatePrincipal === true;
}

// Agency approval (Campaign Monitor "Authorize Broadcast"): spec allows these two roles.
export const PUBLISHER_ROLES: readonly UserRole[] = ['AGENCY_ADMIN', 'CANDIDATE_MANAGER'];
