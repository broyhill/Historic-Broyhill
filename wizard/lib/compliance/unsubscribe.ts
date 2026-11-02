// HMAC-signed one-click unsubscribe (RFC 8058). The token names the silo and the subscriber id
// — never the email address — so no personal data rides in the URL.
//   /unsubscribe?silo=<slug>&token=<payload>.<sig>

import { decodeJson, encodeJson, hmacBase64Url, safeEqual } from '../auth/crypto';

interface UnsubscribePayload {
  v: 1;
  s: string; // CandidateSilo.id
  u: string; // Subscriber.id
}

export async function createUnsubscribeToken(siloId: string, subscriberId: string, secret: string): Promise<string> {
  const body = encodeJson({ v: 1, s: siloId, u: subscriberId } satisfies UnsubscribePayload);
  return `${body}.${await hmacBase64Url(secret, `unsubscribe:${body}`)}`;
}

export async function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret: string,
): Promise<{ siloId: string; subscriberId: string } | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (!safeEqual(signature, await hmacBase64Url(secret, `unsubscribe:${body}`))) return null;
  const payload = decodeJson<UnsubscribePayload>(body);
  if (!payload || payload.v !== 1 || typeof payload.s !== 'string' || typeof payload.u !== 'string') return null;
  return { siloId: payload.s, subscriberId: payload.u };
}

export function unsubscribeUrl(baseUrl: string, siloSlug: string, token: string): string {
  const url = new URL('/unsubscribe', baseUrl);
  url.searchParams.set('silo', siloSlug);
  url.searchParams.set('token', token);
  return url.toString();
}

export function oneClickEndpoint(baseUrl: string, siloSlug: string, token: string): string {
  const url = new URL('/api/unsubscribe', baseUrl);
  url.searchParams.set('silo', siloSlug);
  url.searchParams.set('token', token);
  return url.toString();
}

// RFC 2369 + RFC 8058 headers for one-click unsubscribe in Gmail / Yahoo / Apple Mail.
export function listUnsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
