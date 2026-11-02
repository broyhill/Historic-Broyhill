// Runtime configuration. Every default is the safe one: no live sends, no paid calls,
// no secrets assumed. Nothing here grants authority — the gates in lib/dispatch/gates.ts do.

export const AUTHORIZATION_PHRASE = 'I AUTHORIZE THIS ACTION';

export const DEFAULT_SILO_SLUG = 'broyhillgop';
export const DEFAULT_SILO_NAME = 'BroyhillGOP';
export const DEFAULT_FROM_NAME = 'BroyhillGOP Concierge';
export const DEFAULT_FROM_EMAIL = 'Info@Broyhill.net';
export const DEFAULT_PHYSICAL_ADDRESS = 'BroyhillGOP • 3540 Clemmons Road, Clemmons, NC 27012';
export const AGENCY_NAME = 'Broyhill GOP Command';

export const ACTIVE_SILO_COOKIE = 'broyhill_active_silo';
export const SILO_HEADER = 'x-candidate-silo';
export const AGENCY_OVERVIEW_SLUG = '__agency__';
export const SESSION_COOKIE = 'bgop_wizard_agency_session';

type Env = Record<string, string | undefined>;

export function isProduction(env: Env = process.env): boolean {
  return env.NODE_ENV === 'production';
}

// LIVE is requested only by an explicit operator setting, and is ignored outside production.
export function requestedDispatchMode(env: Env = process.env): 'DRY_RUN' | 'LIVE' {
  return env.WIZARD_DISPATCH_MODE === 'LIVE' && isProduction(env) ? 'LIVE' : 'DRY_RUN';
}

// Ed's explicit live order, bound to one campaign and one exact content hash:
// WIZARD_ED_LIVE_ORDER="<campaignId>:<contentHash>". Unset means no order.
export function edLiveOrder(env: Env = process.env): string | undefined {
  const value = env.WIZARD_ED_LIVE_ORDER?.trim();
  return value ? value : undefined;
}

// Where an unresolved request lands. 'default' = the BroyhillGOP silo (Prompt 1 Track A);
// 'none' = refuse (Campaign Monitor doc resolves by URL only). Provisional — Conflict C2.
export function tenantFallback(env: Env = process.env): 'default' | 'none' {
  return env.WIZARD_TENANT_FALLBACK === 'none' ? 'none' : 'default';
}

export function defaultSiloSlug(env: Env = process.env): string {
  return env.WIZARD_DEFAULT_SILO_SLUG?.trim() || DEFAULT_SILO_SLUG;
}

export function requireSecret(name: string, env: Env = process.env): string {
  const value = env[name];
  if (!value || value.length < 16) {
    throw new Error(`${name} is not configured (min 16 chars); refusing to continue`);
  }
  return value;
}

export function publicBaseUrl(env: Env = process.env): string {
  return (env.WIZARD_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
