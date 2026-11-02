// Sent messages are immutable. A variant is frozen once it is authorized or dispatched LIVE; a
// revision after that creates a child variant (parentVariantId) with a new composition hash,
// which no existing Wizard authorization covers.
//
// The composition hash covers what the candidate authorizes: subject, preheader and the block
// composition. Per-recipient rendering (merge values, unsubscribe link) happens at dispatch and
// is recorded separately as DispatchRecord.renderedHash.

import { createHash } from 'node:crypto';
import type { EmailBlock } from './templates/blocks';

export interface Composition {
  subject: string;
  preheader?: string | null;
  blocks: EmailBlock[];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function compositionHash(composition: Composition): string {
  const payload = JSON.stringify(canonical({
    subject: composition.subject,
    preheader: composition.preheader ?? '',
    blocks: composition.blocks,
  }));
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface VariantRow {
  id: string;
  version: number;
  contentHash: string;
  frozenAt: Date | null;
}

export type RevisionPlan =
  | { action: 'CREATE_FIRST'; version: 1; contentHash: string }
  | { action: 'NO_CHANGE'; variantId: string; contentHash: string }
  | { action: 'UPDATE_IN_PLACE'; variantId: string; contentHash: string }
  | { action: 'CREATE_CHILD'; parentVariantId: string; version: number; contentHash: string };

export function planRevision(latest: VariantRow | null, next: Composition): RevisionPlan {
  const hash = compositionHash(next);
  if (!latest) return { action: 'CREATE_FIRST', version: 1, contentHash: hash };
  if (latest.contentHash === hash) return { action: 'NO_CHANGE', variantId: latest.id, contentHash: hash };
  if (latest.frozenAt) {
    return { action: 'CREATE_CHILD', parentVariantId: latest.id, version: latest.version + 1, contentHash: hash };
  }
  return { action: 'UPDATE_IN_PLACE', variantId: latest.id, contentHash: hash };
}

export class FrozenVariantError extends Error {
  constructor(variantId: string) {
    super(`Variant ${variantId} is frozen (authorized or dispatched); revise by creating a child variant`);
    this.name = 'FrozenVariantError';
  }
}

export function assertMutable(variant: VariantRow): void {
  if (variant.frozenAt) throw new FrozenVariantError(variant.id);
}
