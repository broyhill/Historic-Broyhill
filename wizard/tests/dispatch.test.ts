import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUTHORIZATION_PHRASE } from '../lib/config';
import { unboundPlatformSuppression, type PlatformSuppressionSource } from '../lib/compliance/suppression';
import { dispatchCampaign, DispatchNotFoundError, type CourierDeps } from '../lib/dispatch/courier';
import { evaluateCampaignGates, type CampaignGateInput } from '../lib/dispatch/gates';
import { unboundE10Clearance, unboundE20Go } from '../lib/dispatch/providers';
import { MemoryDispatchStore } from '../lib/dispatch/store-memory';
import type { EmailTransport, OutboundEmail } from '../lib/dispatch/transport';
import { AGENCY_ID, DEMO_SILO, SAMPLE_HASH, demoState } from './fixtures';

const granted = { granted: true, detail: 'granted (test double)', reference: 'ref-1' };

function allPass(): CampaignGateInput {
  return {
    campaign: { id: 'cmp-1', status: 'PUBLISHED', channel: 'EMAIL', messageClass: 'BULK', reviewedByRole: 'CANDIDATE_MANAGER' },
    variant: { id: 'var-1', contentHash: SAMPLE_HASH },
    authorizations: [{ id: 'a', contentHash: SAMPLE_HASH, phrase: AUTHORIZATION_PHRASE, authorizedByPrincipal: true }],
    channelGoverned: true,
    e20: granted,
    e10: granted,
    platformSuppressionAvailable: true,
    killSwitchEngaged: false,
    edLiveOrder: `cmp-1:${SAMPLE_HASH}`,
    requestedMode: 'LIVE',
  };
}

describe('campaign gates', () => {
  it('goes LIVE only when every gate passes', () => {
    assert.equal(evaluateCampaignGates(allPass()).effectiveMode, 'LIVE');
  });

  it('any single failing live gate falls back to DRY_RUN', () => {
    const breakers: Array<[string, (i: CampaignGateInput) => void]> = [
      ['no authorization', (i) => { i.authorizations = []; }],
      ['authorization for another hash', (i) => { i.authorizations = [{ id: 'a', contentHash: 'other', phrase: AUTHORIZATION_PHRASE, authorizedByPrincipal: true }]; }],
      ['authorized by a non-principal', (i) => { i.authorizations = [{ id: 'a', contentHash: SAMPLE_HASH, phrase: AUTHORIZATION_PHRASE, authorizedByPrincipal: false }]; }],
      ['wrong phrase', (i) => { i.authorizations = [{ id: 'a', contentHash: SAMPLE_HASH, phrase: 'yes', authorizedByPrincipal: true }]; }],
      ['no E20 GO', (i) => { i.e20 = { granted: false, detail: 'x' }; }],
      ['no E10 clearance', (i) => { i.e10 = { granted: false, detail: 'x' }; }],
      ['platform suppression unreadable', (i) => { i.platformSuppressionAvailable = false; }],
      ['kill switch engaged', (i) => { i.killSwitchEngaged = true; }],
      ["no Ed order", (i) => { i.edLiveOrder = undefined; }],
      ["Ed order for another hash", (i) => { i.edLiveOrder = 'cmp-1:other'; }],
      ['dry-run runtime', (i) => { i.requestedMode = 'DRY_RUN'; }],
    ];
    for (const [label, breakIt] of breakers) {
      const input = allPass();
      breakIt(input);
      assert.equal(evaluateCampaignGates(input).effectiveMode, 'DRY_RUN', label);
    }
  });

  it('human-originated campaigns pass AGENT_DELEGATION trivially', () => {
    const gate = evaluateCampaignGates(allPass()).gates.find((g) => g.gate === 'AGENT_DELEGATION');
    assert.equal(gate?.pass, true);
  });

  it('agent-originated campaigns need a live delegation to dispatch at all', () => {
    const agent = { agentKey: 'wizard-ai', action: 'dispatch' };
    const live = { id: 'd1', agentKey: 'wizard-ai', privileges: ['draft', 'dispatch'], expiresAt: null, revokedAt: null };
    const breakers: Array<[string, Partial<CampaignGateInput>]> = [
      ['no delegations at all', { agentAction: agent }],
      ['wrong agent', { agentAction: agent, delegations: [{ ...live, agentKey: 'other-bot' }] }],
      ['privilege not granted', { agentAction: agent, delegations: [{ ...live, privileges: ['draft'] }] }],
      ['expired', { agentAction: agent, delegations: [{ ...live, expiresAt: new Date('2020-01-01') }] }],
      ['revoked', { agentAction: agent, delegations: [{ ...live, revokedAt: new Date() }] }],
    ];
    for (const [label, patch] of breakers) {
      const input = { ...allPass(), ...patch };
      assert.equal(evaluateCampaignGates(input).effectiveMode, 'BLOCKED', label);
    }
    const granted = { ...allPass(), agentAction: agent, delegations: [live] };
    assert.equal(evaluateCampaignGates(granted).dispatchAllowed, true);
  });

  it('dispatch-tier failures block even a dry-run', () => {
    for (const breakIt of [
      (i: CampaignGateInput) => { i.campaign.status = 'PENDING_REVIEW'; },
      (i: CampaignGateInput) => { i.campaign.reviewedByRole = 'CAMPAIGN_DRAFTER'; },
      (i: CampaignGateInput) => { i.channelGoverned = false; },
      (i: CampaignGateInput) => { i.variant = null; },
    ]) {
      const input = allPass();
      breakIt(input);
      assert.equal(evaluateCampaignGates(input).effectiveMode, 'BLOCKED');
    }
  });
});

function deps(store: MemoryDispatchStore, overrides: Partial<CourierDeps> = {}): CourierDeps {
  return {
    store, e20: unboundE20Go, e10: unboundE10Clearance, platformSuppression: unboundPlatformSuppression,
    transport: null, unsubscribeSecret: 'test-unsubscribe-secret-0123456789abcdef', baseUrl: 'https://example.org',
    requestedMode: 'DRY_RUN', edLiveOrder: undefined, now: () => new Date('2026-10-15T00:00:00Z'), log: () => undefined,
    ...overrides,
  };
}

describe('courier', () => {
  it('dry-runs in development: held, suppressed and isolated recipients never render', async () => {
    const state = demoState();
    const summary = await dispatchCampaign(deps(new MemoryDispatchStore(state)), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    const byEmail = Object.fromEntries(summary.outcomes.map((o) => [o.email, o.mode]));
    assert.deepEqual(byEmail, { 'ada@example.com': 'DRY_RUN', 'bo@example.com': 'HELD', 'cy@example.com': 'SUPPRESSED', 'di@example.com': 'SUPPRESSED' });
    assert.equal(summary.outcomes.some((o) => o.email === 'eve@example.com'), false);
    assert.equal(state.dispatches.length, 4);
  });

  it('sends LIVE exactly once per recipient when every gate passes, and freezes the variant', async () => {
    const state = demoState();
    state.killSwitch[AGENCY_ID] = false;
    state.variants[0]!.frozenAt = null;
    const sent: OutboundEmail[] = [];
    const transport: EmailTransport = { name: 'test', send: async (m) => { sent.push(m); return { providerMessageId: `pm-${sent.length}` }; } };
    const platform: PlatformSuppressionSource = { name: 'test', available: async () => true, rowsFor: async () => [] };
    const live = deps(new MemoryDispatchStore(state), {
      e20: { name: 't', check: async () => granted }, e10: { name: 't', check: async () => granted },
      platformSuppression: platform, transport, requestedMode: 'LIVE', edLiveOrder: `cmp-1:${SAMPLE_HASH}`,
    });
    const first = await dispatchCampaign(live, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    assert.equal(first.report.effectiveMode, 'LIVE');
    assert.deepEqual(sent.map((m) => m.to), ['ada@example.com']);
    assert.equal(sent[0]!.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.match(sent[0]!.html, /3540 Clemmons Road/);
    // Re-read through find() so the earlier `= null` assignment does not narrow the type.
    assert.ok(state.variants.find((v) => v.id === 'var-1')?.frozenAt instanceof Date, 'variant frozen by LIVE dispatch');
    const ada = state.dispatches.find((d) => d.recipientEmail === 'ada@example.com');
    assert.equal(ada?.providerMessageId, 'pm-1');
    // Idempotency is recorded per variant × recipient: a repeat is flagged and records nothing new.
    await dispatchCampaign(live, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    assert.equal(state.dispatches.length, 4);
  });

  it('refuses LIVE with no transport rather than reporting success', async () => {
    const state = demoState();
    state.killSwitch[AGENCY_ID] = false;
    const live = deps(new MemoryDispatchStore(state), {
      e20: { name: 't', check: async () => granted }, e10: { name: 't', check: async () => granted },
      platformSuppression: { name: 't', available: async () => true, rowsFor: async () => [] },
      requestedMode: 'LIVE', edLiveOrder: `cmp-1:${SAMPLE_HASH}`,
    });
    await assert.rejects(dispatchCampaign(live, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' }), /no transport/);
  });

  it('cannot reach a campaign from another silo', async () => {
    await assert.rejects(
      dispatchCampaign(deps(new MemoryDispatchStore(demoState())), { candidateId: 'silo-broyhillgop', campaignId: 'cmp-1', requestedById: 't' }),
      DispatchNotFoundError,
    );
  });

  it('a silo with no named candidate holds every recipient', async () => {
    const state = demoState();
    state.silos[0]!.candidateName = null;
    const summary = await dispatchCampaign(deps(new MemoryDispatchStore(state)), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    assert.equal(summary.counts.DRY_RUN, 0);
    assert.ok(summary.outcomes.filter((o) => o.mode === 'HELD').every((o) => o.reason.includes('candidate_name')));
  });

  it('scores every silo recipient through the feeder and files explainable proposals', async () => {
    const state = demoState();
    const now = new Date('2026-10-15T00:00:00Z');
    const recent = (d: number) => new Date(now.getTime() - d * 86400000);
    // sub-ada: engaged loyalist; sub-di: complained (negative → suppression proposal).
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: recent(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: recent(3) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: recent(5) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-di', type: 'COMPLAINED', occurredAt: recent(10) },
      // Cross-silo activity must not leak into this silo's scoring.
      { candidateId: 'silo-broyhillgop', subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: recent(1) },
    );
    const store = new MemoryDispatchStore(state);
    await dispatchCampaign(deps(store), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });

    // All 4 silo recipients were scored; eve (other silo) was never touched.
    assert.deepEqual(
      state.feederVerdicts.map((v) => v.subscriberId).sort(),
      ['sub-ada', 'sub-bo', 'sub-cy', 'sub-di'],
    );
    const ada = state.feederVerdicts.find((v) => v.subscriberId === 'sub-ada')!;
    assert.equal(ada.verdict.affinity, 'LOYAL');
    assert.equal(ada.verdict.action, 'HIGH_INTENT_CONVERSION');
    assert.equal(ada.journeyId, 'cmp-1');
    assert.ok(ada.slices.HighValueConversionPropensity);
    const di = state.feederVerdicts.find((v) => v.subscriberId === 'sub-di')!;
    assert.equal(di.verdict.action, 'REENGAGEMENT_SUPPRESSION');
    // Proposals: ada (conversion) + di (suppression); every proposal carries its why-vector.
    const proposals = state.feederProposals.filter((p) => p.status === 'PENDING_APPROVAL');
    assert.deepEqual(
      proposals.map((p) => `${p.subscriberId}:${p.action}`).sort(),
      ['sub-ada:HIGH_INTENT_CONVERSION', 'sub-di:REENGAGEMENT_SUPPRESSION'],
    );
    assert.ok(proposals.every((p) => p.reason.includes('affinity=') && p.reason.includes('→')));
    // Repeat dispatch: verdicts re-score but pending proposals are not duplicated.
    await dispatchCampaign(deps(store), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    assert.equal(state.feederProposals.length, 2);
  });
});
