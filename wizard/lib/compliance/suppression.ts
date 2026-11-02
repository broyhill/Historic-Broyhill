// Dual-scope suppression (Weapon 13): GlobalSuppression (agency) + SiloSuppression (candidate),
// plus the platform's own lists read through PlatformSuppressionSource (e30.suppression_list,
// brain.suppression_list deceased screen) so this package never builds a parallel list of truth.
//
// Channel suppression is not a relationship decision (Seven Gods, God 6): a BULK_ONLY entry
// blocks bulk email only; event invitations and personal candidate contact still pass. An
// ALL_EMAIL entry (hard bounce, deceased) blocks every email class.

import type { MessageClass, SuppressionLevel } from '@prisma/client';
import { normalizeEmail } from '../identity';

export type SuppressionScope = 'SILO' | 'GLOBAL' | 'PLATFORM_E30' | 'PLATFORM_BRAIN';

export interface SuppressionRow {
  email: string;
  level: SuppressionLevel;
  reason: string;
  scope: SuppressionScope;
}

export interface SuppressionVerdict {
  suppressed: boolean;
  matched: SuppressionRow[];
  blocking: SuppressionRow[];
}

export function blocks(row: SuppressionRow, messageClass: MessageClass): boolean {
  return row.level === 'ALL_EMAIL' || (row.level === 'BULK_ONLY' && messageClass === 'BULK');
}

export function checkSuppression(email: string, messageClass: MessageClass, rows: SuppressionRow[]): SuppressionVerdict {
  const target = normalizeEmail(email);
  // An address we cannot normalize can never be proven unsuppressed: block it.
  if (!target) {
    const invalid: SuppressionRow = { email, level: 'ALL_EMAIL', reason: 'invalid address', scope: 'SILO' };
    return { suppressed: true, matched: [invalid], blocking: [invalid] };
  }
  const matched = rows.filter((row) => normalizeEmail(row.email) === target);
  const blocking = matched.filter((row) => blocks(row, messageClass));
  return { suppressed: blocking.length > 0, matched, blocking };
}

// Which level a provider event writes (Track B §4). Provisional — Conflict C7.
export function levelForEvent(event: 'HARD_BOUNCE' | 'COMPLAINT' | 'UNSUBSCRIBE'): SuppressionLevel {
  return event === 'HARD_BOUNCE' ? 'ALL_EMAIL' : 'BULK_ONLY';
}

// Escalate, never downgrade: ALL_EMAIL beats BULK_ONLY when the same address recurs.
export function mergeLevel(existing: SuppressionLevel | null | undefined, incoming: SuppressionLevel): SuppressionLevel {
  return existing === 'ALL_EMAIL' || incoming === 'ALL_EMAIL' ? 'ALL_EMAIL' : 'BULK_ONLY';
}

// The platform's existing suppression lists on Hetzner. Bound by an adapter only when an
// authorized read path exists; until then the source reports itself unavailable and the LIVE
// gate stays shut (lib/dispatch/gates.ts PLATFORM_SUPPRESSION_SOURCE).
export interface PlatformSuppressionSource {
  readonly name: string;
  available(): Promise<boolean>;
  rowsFor(emails: string[]): Promise<SuppressionRow[]>;
}

export const unboundPlatformSuppression: PlatformSuppressionSource = {
  name: 'e30.suppression_list + brain.suppression_list (adapter not bound)',
  available: async () => false,
  rowsFor: async () => [],
};
