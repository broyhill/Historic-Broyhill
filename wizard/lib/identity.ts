// Deterministic identity only (Ed, 2026-10-08: "We don't cluster donor data sets. We don't fuzzy
// either."). Every key here is an exact, normalized value. There is deliberately no similarity
// scoring, no household inference and no lookalike linking anywhere in this package.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// RNC_RegID is TEXT and stored verbatim (trimmed). It is accepted only from a source the caller
// asserts is authoritative (voter-file bridge or vendor-supplied RegID). A web form is not one,
// so capture never sets it — the subscriber stays HELD_MISSING_EVIDENCE.
export function exactRncRegId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > 0 && value.length <= 64 && !/\s/.test(value) ? value : null;
}

export type IdentityStateValue = 'HELD_MISSING_EVIDENCE' | 'RNC_REGID_EXACT';

export function identityStateFor(rncRegId: string | null | undefined): IdentityStateValue {
  return rncRegId ? 'RNC_REGID_EXACT' : 'HELD_MISSING_EVIDENCE';
}

// Exit gate (Ed 2026-10-08): nothing leaves without (1) RNC_RegID and (2) candidate name /
// committee id. Returns the missing keys; an empty list means the recipient may proceed.
export function exitGateMissing(input: {
  rncRegId: string | null | undefined;
  candidateName: string | null | undefined;
  committeeId: string | null | undefined;
}): string[] {
  const missing: string[] = [];
  if (!input.rncRegId) missing.push('rnc_regid');
  if (!input.candidateName?.trim()) missing.push('candidate_name');
  if (!input.committeeId?.trim()) missing.push('committee_id');
  return missing;
}
