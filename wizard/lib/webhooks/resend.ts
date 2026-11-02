// Resend telemetry gateway (Weapon 16). Resend signs webhooks with Svix:
//   headers svix-id, svix-timestamp, svix-signature ("v1,<base64> v1,<base64> …")
//   signed content `${svix-id}.${svix-timestamp}.${rawBody}`, key = base64 part of "whsec_…"
// Bounces and complaints become suppression writes in BOTH scopes (Track B §4); every event
// becomes a SubscriberActivity row, idempotent on the Svix message id.

import type { ActivityType, SuppressionLevel } from '@prisma/client';
import { fromBase64Url, hmacSha256, safeEqual, toBase64Url } from '../auth/crypto';
import { normalizeEmail } from '../identity';
import { levelForEvent } from '../compliance/suppression';

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  return fromBase64Url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

function bytesToBase64(bytes: Uint8Array): string {
  const url = toBase64Url(bytes).replace(/-/g, '+').replace(/_/g, '/');
  return url + '='.repeat((4 - (url.length % 4)) % 4);
}

export async function signSvix(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = base64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret);
  return `v1,${bytesToBase64(await hmacSha256(key, `${id}.${timestamp}.${body}`))}`;
}

export async function verifySvix(
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SVIX_TOLERANCE_SECONDS) return false;
  const expected = await signSvix(secret, id, timestamp, body);
  return signature.split(' ').some((candidate) => safeEqual(candidate.trim(), expected));
}

export interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

export interface ActivityPlan {
  email: string;
  type: ActivityType;
  providerMessageId: string | null;
  occurredAt: Date;
  suppression: { level: SuppressionLevel; reason: string } | null;
}

const TYPE_MAP: Record<string, ActivityType> = {
  'email.delivered': 'DELIVERED',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
};

// A bounce is soft only when Resend says so explicitly; anything else is treated as hard so a
// dead address is never mailed again (conservative; Conflict C7).
export function isHardBounce(event: ResendEvent): boolean {
  const kind = `${event.data?.bounce?.type ?? ''} ${event.data?.bounce?.subType ?? ''}`.toLowerCase();
  return !/(transient|temporary|soft)/.test(kind);
}

export function planForEvent(event: ResendEvent): ActivityPlan[] {
  const type = TYPE_MAP[event.type];
  if (!type) return [];
  const recipients = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : [];
  const occurredAt = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at) : new Date();
  let suppression: ActivityPlan['suppression'] = null;
  if (type === 'BOUNCED' && isHardBounce(event)) {
    suppression = { level: levelForEvent('HARD_BOUNCE'), reason: `hard bounce${event.data?.bounce?.message ? `: ${event.data.bounce.message}` : ''}` };
  } else if (type === 'COMPLAINED') {
    suppression = { level: levelForEvent('COMPLAINT'), reason: 'spam complaint' };
  }
  return recipients
    .map((raw) => normalizeEmail(raw))
    .filter((email): email is string => Boolean(email))
    .map((email) => ({ email, type, providerMessageId: event.data?.email_id ?? null, occurredAt, suppression }));
}
