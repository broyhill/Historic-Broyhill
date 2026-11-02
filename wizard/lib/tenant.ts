// Tenant isolation layer. Resolves the active candidate silo for a request and decides whether
// the signed-in user may act in it. Every /api/admin/* query is then scoped by candidateId
// (lib/scope.ts), so a user can never read or write another candidate's rows.
//
// Resolution order (Prompt 1 Track A + Campaign Monitor doc, both kept — Conflict C2):
//   1. header  x-candidate-silo
//   2. cookie  broyhill_active_silo
//   3. URL     /silo/<slug>/... or /admin/silo/<slug>/...
//   4. fallback: non-admins → their own silo; admins → default silo `broyhillgop`
//      (or refuse when WIZARD_TENANT_FALLBACK=none).

import {
  ACTIVE_SILO_COOKIE,
  AGENCY_OVERVIEW_SLUG,
  SILO_HEADER,
  defaultSiloSlug,
  tenantFallback,
} from './config';
import type { SessionPayload } from './auth/session';

export interface SiloRef {
  id: string;
  slug: string;
  name: string;
  agencyId: string;
  candidateName: string | null;
}

export type TenantSource = 'header' | 'cookie' | 'url' | 'home' | 'default';

export type TenantContext =
  | { kind: 'SILO'; silo: SiloRef; source: TenantSource }
  | { kind: 'AGENCY'; agencyId: string; source: TenantSource };

export class TenantError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404, message: string) {
    super(message);
    this.name = 'TenantError';
  }
}

export interface SiloLookup {
  bySlug(slug: string): Promise<SiloRef | null>;
  byId(id: string): Promise<SiloRef | null>;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$|^__agency__$/;

export function siloSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/(?:admin\/)?silo\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : null;
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export interface TenantInput {
  header?: string | null;
  cookie?: string | null;
  pathname?: string | null;
}

export function pickExplicitSlug(input: TenantInput): { slug: string; source: TenantSource } | null {
  const candidates: Array<[string | null | undefined, TenantSource]> = [
    [input.header, 'header'],
    [input.cookie, 'cookie'],
    [siloSlugFromPath(input.pathname), 'url'],
  ];
  for (const [raw, source] of candidates) {
    const slug = raw?.trim().toLowerCase();
    if (!slug) continue;
    if (!SLUG.test(slug)) throw new TenantError(400, `Malformed silo identifier from ${source}`);
    return { slug, source };
  }
  return null;
}

export async function resolveTenant(
  input: TenantInput,
  session: SessionPayload | null,
  lookup: SiloLookup,
  env: Record<string, string | undefined> = process.env,
): Promise<TenantContext> {
  if (!session) throw new TenantError(401, 'Not signed in');
  const home = await lookup.byId(session.cid);
  if (!home) throw new TenantError(403, 'Signed-in user has no silo');
  const isAgencyAdmin = session.role === 'AGENCY_ADMIN';
  const explicit = pickExplicitSlug(input);

  if (explicit?.slug === AGENCY_OVERVIEW_SLUG) {
    if (!isAgencyAdmin) throw new TenantError(403, 'Agency overview is limited to agency admins');
    return { kind: 'AGENCY', agencyId: home.agencyId, source: explicit.source };
  }

  if (explicit) {
    const silo = await lookup.bySlug(explicit.slug);
    if (!silo) throw new TenantError(404, `Unknown silo "${explicit.slug}"`);
    // Same-agency only, and only admins cross silos. A stale cookie never widens access.
    if (silo.agencyId !== home.agencyId) throw new TenantError(403, 'Silo belongs to another agency');
    if (!isAgencyAdmin && silo.id !== home.id) throw new TenantError(403, 'Not permitted in this silo');
    return { kind: 'SILO', silo, source: explicit.source };
  }

  if (!isAgencyAdmin) return { kind: 'SILO', silo: home, source: 'home' };

  if (tenantFallback(env) === 'none') throw new TenantError(400, 'No silo selected');
  const fallback = await lookup.bySlug(defaultSiloSlug(env));
  if (!fallback || fallback.agencyId !== home.agencyId) throw new TenantError(404, 'Default silo is not provisioned');
  return { kind: 'SILO', silo: fallback, source: 'default' };
}

export function tenantInputFromRequest(request: Request): TenantInput {
  return {
    header: request.headers.get(SILO_HEADER),
    cookie: readCookie(request.headers.get('cookie'), ACTIVE_SILO_COOKIE),
    pathname: new URL(request.url).pathname,
  };
}

// Prisma-backed lookup. Imported lazily so pure callers (tests, middleware) never load Prisma.
export async function prismaSiloLookup(): Promise<SiloLookup> {
  const { prisma } = await import('./prisma');
  const select = { id: true, slug: true, name: true, agencyId: true, candidateName: true } as const;
  return {
    bySlug: (slug) => prisma.candidateSilo.findUnique({ where: { slug }, select }),
    byId: (id) => prisma.candidateSilo.findUnique({ where: { id }, select }),
  };
}

export async function getCurrentTenant(request: Request, session: SessionPayload | null): Promise<TenantContext> {
  return resolveTenant(tenantInputFromRequest(request), session, await prismaSiloLookup());
}
