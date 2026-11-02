import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SessionPayload } from '../lib/auth/session';
import { can, canAuthorizeWizard } from '../lib/rbac';
import { pickExplicitSlug, resolveTenant, siloSlugFromPath, TenantError, type SiloLookup, type SiloRef } from '../lib/tenant';

const silos: SiloRef[] = [
  { id: 's-default', slug: 'broyhillgop', name: 'BroyhillGOP', agencyId: 'a1', candidateName: null },
  { id: 's-a', slug: 'candidate-a', name: 'A', agencyId: 'a1', candidateName: 'Candidate A' },
  { id: 's-b', slug: 'candidate-b', name: 'B', agencyId: 'a1', candidateName: 'Candidate B' },
  { id: 's-x', slug: 'other-agency', name: 'X', agencyId: 'a2', candidateName: 'X' },
];
const lookup: SiloLookup = {
  bySlug: async (slug) => silos.find((s) => s.slug === slug) ?? null,
  byId: async (id) => silos.find((s) => s.id === id) ?? null,
};
const session = (role: SessionPayload['role'], cid: string): SessionPayload => ({ uid: 'u', cid, role, principal: false, exp: 9e9 });
const admin = session('AGENCY_ADMIN', 's-default');
const managerA = session('CANDIDATE_MANAGER', 's-a');

async function rejects(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (e: unknown) => e instanceof TenantError && e.status === status);
}

describe('tenant resolution', () => {
  it('prefers header over cookie over URL', () => {
    assert.deepEqual(pickExplicitSlug({ header: 'candidate-a', cookie: 'candidate-b', pathname: '/silo/broyhillgop' }), { slug: 'candidate-a', source: 'header' });
    assert.deepEqual(pickExplicitSlug({ cookie: 'candidate-b', pathname: '/silo/broyhillgop' }), { slug: 'candidate-b', source: 'cookie' });
    assert.deepEqual(pickExplicitSlug({ pathname: '/admin/silo/Candidate-A/campaigns' }), { slug: 'candidate-a', source: 'url' });
    assert.equal(siloSlugFromPath('/admin/campaigns'), null);
  });

  it('rejects malformed slugs', () => {
    assert.throws(() => pickExplicitSlug({ header: "x'; drop table" }), TenantError);
  });

  it('admins switch freely within their agency and fall back to the default silo', async () => {
    assert.equal(((await resolveTenant({ cookie: 'candidate-b' }, admin, lookup)) as { silo: SiloRef }).silo.slug, 'candidate-b');
    const fallback = await resolveTenant({}, admin, lookup, {});
    assert.equal(fallback.kind === 'SILO' && fallback.silo.slug, 'broyhillgop');
    assert.equal(fallback.source, 'default');
    assert.equal((await resolveTenant({ header: '__agency__' }, admin, lookup)).kind, 'AGENCY');
  });

  it('refuses cross-agency silos even for admins', async () => {
    await rejects(resolveTenant({ header: 'other-agency' }, admin, lookup), 403);
  });

  it('pins non-admins to their own silo', async () => {
    const home = await resolveTenant({}, managerA, lookup);
    assert.equal(home.kind === 'SILO' && home.silo.id, 's-a');
    assert.equal(home.source, 'home');
    await rejects(resolveTenant({ cookie: 'candidate-b' }, managerA, lookup), 403);
    await rejects(resolveTenant({ header: '__agency__' }, managerA, lookup), 403);
  });

  it('honors WIZARD_TENANT_FALLBACK=none and unknown silos', async () => {
    await rejects(resolveTenant({}, admin, lookup, { WIZARD_TENANT_FALLBACK: 'none' }), 400);
    await rejects(resolveTenant({ header: 'nope' }, admin, lookup), 404);
    await rejects(resolveTenant({}, null, lookup), 401);
  });
});

describe('RBAC', () => {
  it('matches the four-role matrix', () => {
    assert.equal(can('AGENCY_ADMIN', 'silo.switch'), true);
    assert.equal(can('CANDIDATE_MANAGER', 'silo.switch'), false);
    assert.equal(can('CANDIDATE_MANAGER', 'campaign.publish'), true);
    assert.equal(can('CAMPAIGN_DRAFTER', 'campaign.publish'), false);
    assert.equal(can('CAMPAIGN_DRAFTER', 'campaign.submit'), true);
    assert.equal(can('COMPLIANCE_VIEWER', 'campaign.draft'), false);
    assert.equal(can('COMPLIANCE_VIEWER', 'suppression.read'), true);
    assert.equal(can('CANDIDATE_MANAGER', 'suppression.global.write'), false);
  });

  it('reserves Wizard authorization for the candidate principal', () => {
    assert.equal(canAuthorizeWizard({ isCandidatePrincipal: false }), false);
    assert.equal(canAuthorizeWizard({ isCandidatePrincipal: true }), true);
  });
});
