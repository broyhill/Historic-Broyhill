// Candidate-scoped query helpers. Every /api/admin/* read and write goes through these so the
// candidateId predicate cannot be forgotten.

import { TenantError, type TenantContext } from './tenant';

export type SiloTenant = Extract<TenantContext, { kind: 'SILO' }>;

export function requireSilo(tenant: TenantContext): SiloTenant {
  if (tenant.kind !== 'SILO') throw new TenantError(400, 'Select a candidate silo for this action');
  return tenant;
}

export function scoped<W extends object>(tenant: SiloTenant, where?: W): W & { candidateId: string } {
  return { ...(where ?? ({} as W)), candidateId: tenant.silo.id };
}

// For rows fetched by id: a row from another silo is reported as missing, not forbidden,
// so silo existence never leaks across tenants.
export function assertInSilo<T extends { candidateId: string | null }>(
  row: T | null,
  tenant: SiloTenant,
  label = 'Record',
): T {
  if (!row || row.candidateId !== tenant.silo.id) throw new TenantError(404, `${label} not found`);
  return row;
}
