// Route-handler plumbing: one wrapper so every /api/admin/* handler gets a verified session, a
// re-checked user, a resolved tenant and an RBAC permission check — in that order — or a clean
// error. Handlers never see a request that skipped any of the four.

import type { UserRole } from '@generated/wizard-prisma';
import { NextResponse } from 'next/server';
import { verifySessionToken, type SessionPayload } from './auth/session';
import { SESSION_COOKIE } from './config';
import { CompileError } from './templates/compiler';
import { BlockValidationError } from './templates/blocks';
import { DispatchNotFoundError } from './dispatch/courier';
import { can, type Permission } from './rbac';
import { LifecycleError } from './services/campaigns';
import { CaptureInputError } from './services/capture';
import { FrozenVariantError } from './variants';
import { getCurrentTenant, readCookie, TenantError, type TenantContext } from './tenant';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function sessionFromCookieValue(token: string | undefined): Promise<SessionPayload | null> {
  return verifySessionToken(token, process.env.WIZARD_SESSION_SECRET);
}

export async function sessionFrom(request: Request): Promise<SessionPayload | null> {
  return sessionFromCookieValue(readCookie(request.headers.get('cookie'), SESSION_COOKIE) ?? undefined);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof TenantError) return json({ error: error.message }, error.status);
  if (error instanceof LifecycleError) return json({ error: error.message }, error.status);
  if (error instanceof CaptureInputError) return json({ error: error.message }, error.status);
  if (error instanceof BlockValidationError) return json({ error: 'Invalid template blocks', issues: error.issues }, 400);
  if (error instanceof CompileError) return json({ error: 'Template does not compile', issues: error.issues }, 422);
  if (error instanceof FrozenVariantError) return json({ error: error.message }, 409);
  if (error instanceof DispatchNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof SyntaxError) return json({ error: 'Invalid JSON body' }, 400);
  console.error('[wizard-agency] unhandled', error);
  return json({ error: 'Internal error' }, 500);
}

export interface AdminContext {
  session: SessionPayload;
  tenant: TenantContext;
  actor: { userId: string; role: UserRole; isCandidatePrincipal: boolean; homeCandidateId: string };
}

export async function withAdmin(
  request: Request,
  permission: Permission,
  handler: (ctx: AdminContext) => Promise<Response>,
): Promise<Response> {
  try {
    const session = await sessionFrom(request);
    if (!session) return json({ error: 'Not signed in' }, 401);
    const { prisma } = await import('./prisma');
    // Re-read the user: a revoked user or changed role takes effect before the session expires.
    const user = await prisma.candidateUser.findUnique({ where: { id: session.uid } });
    if (!user || user.candidateId !== session.cid) return json({ error: 'Session no longer valid' }, 401);
    if (!can(user.role, permission)) return json({ error: `Role ${user.role} lacks ${permission}` }, 403);
    const tenant = await getCurrentTenant(request, { ...session, role: user.role, principal: user.isCandidatePrincipal });
    return await handler({
      session,
      tenant,
      actor: { userId: user.id, role: user.role, isCandidatePrincipal: user.isCandidatePrincipal, homeCandidateId: user.candidateId },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json()) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SyntaxError('Body must be an object');
  return body as Record<string, unknown>;
}
