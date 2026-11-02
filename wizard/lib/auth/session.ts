// Signed session token: "<base64url(payload)>.<base64url(hmac)>". Never contains a secret,
// cannot be forged without WIZARD_SESSION_SECRET. Verified in middleware and in every route.

import type { UserRole } from '@prisma/client';
import { decodeJson, encodeJson, hmacBase64Url, safeEqual } from './crypto';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  uid: string; // CandidateUser.id
  cid: string; // home CandidateSilo.id
  role: UserRole;
  principal: boolean; // CandidateUser.isCandidatePrincipal
  exp: number; // unix seconds
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const body = encodeJson({ ...payload, exp: nowSeconds + SESSION_MAX_AGE_SECONDS });
  return `${body}.${await hmacBase64Url(secret, `session:${body}`)}`;
}

const ROLES: readonly string[] = ['AGENCY_ADMIN', 'CANDIDATE_MANAGER', 'CAMPAIGN_DRAFTER', 'COMPLIANCE_VIEWER'];

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  // Fail closed: no secret configured means nobody is signed in.
  if (!token || !secret) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (!safeEqual(signature, await hmacBase64Url(secret, `session:${body}`))) return null;
  const payload = decodeJson<SessionPayload>(body);
  if (!payload || typeof payload.uid !== 'string' || typeof payload.cid !== 'string') return null;
  if (!ROLES.includes(payload.role)) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
  return payload;
}
