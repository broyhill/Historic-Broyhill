// CM + revenue optimizer port: DB-free unit coverage over the pure cores — LP scoring
// (P(buy) × value × coefficient, per-subscriber cap), CM success:false-in-200 trap, and
// the healer's fault-signature classifier.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAndCap } from '../lib/cm/optimizer';
import { classifyFault } from '../lib/cm/healer';
import { CampaignMonitorProvider } from '../lib/cm/provider';

const c = (over: Partial<Parameters<typeof scoreAndCap>[0][number]> = {}) => ({
  subscriberId: 'sub-1', email: 'a@b.c', offerId: 'off-1', stepId: 'step-1',
  microsegmentKey: 'seg', propensityOpen: 0, propensityClick: 0, propensityBuy: 0.6,
  ...over,
});

describe('LP optimizer — greedy score + cap', () => {
  it('expectedRevenue = P(buy) × segment value × step coefficient', () => {
    const plan = scoreAndCap([c({ propensityBuy: 0.6 })], () => 1000, () => 0.85, 1);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].expectedRevenue, 0.6 * 1000 * 0.85); // 510
  });

  it('penalized coefficient shrinks allocation value below base', () => {
    const [penalized] = scoreAndCap([c()], () => 1000, () => 0.5, 1);
    const [normal] = scoreAndCap([c()], () => 1000, () => 1.0, 1);
    assert.ok(penalized.expectedRevenue < normal.expectedRevenue);
  });

  it('enforces the per-subscriber touch cap', () => {
    const plan = scoreAndCap(
      [c({ offerId: 'off-A' }), c({ offerId: 'off-B' }), c({ offerId: 'off-C' })],
      () => 100, () => 1, 1,
    );
    assert.equal(plan.length, 1); // same subscriber, cap 1 → highest-score winner only
    assert.equal(plan[0].offerId, 'off-A');
  });

  it('different subscribers each get an allocation', () => {
    const plan = scoreAndCap(
      [c({ subscriberId: 'sub-1' }), c({ subscriberId: 'sub-2' })],
      () => 100, () => 1, 1,
    );
    assert.equal(plan.length, 2);
  });
});

describe('CM provider — success:false-in-200 trap', () => {
  it('throws when a 200 body carries an error payload', async () => {
    const provider = new CampaignMonitorProvider({
      apiKey: 'k',
      fetchImpl: async () => new Response(JSON.stringify({ Code: 123, Message: 'List not found' }), { status: 200 }),
    });
    await assert.rejects(() => provider.readStats('camp-1'), /List not found/);
  });

  it('Resubscribe comes from systemOptIn, never a default true', async () => {
    let sentBody: any;
    const provider = new CampaignMonitorProvider({
      apiKey: 'k',
      fetchImpl: async (_u, init) => { sentBody = JSON.parse(String(init?.body)); return new Response('"{}"', { status: 200 }); },
    });
    await provider.upsertSubscriber('list-1', { email: 'x@y.z', systemOptIn: false });
    assert.equal(sentBody.Resubscribe, false);
  });
});

describe('healer — fault signature classification', () => {
  it('routes each signature to its ladder position', () => {
    assert.equal(classifyFault('HTTP 429 rate limit'), 'RATE_LIMIT_429');
    assert.equal(classifyFault('HTTP 401 unauthorized'), 'API_KEY_REVOKED_401');
    assert.equal('LIST_DELETED_404', classifyFault('HTTP 404 list not found'));
    assert.equal(classifyFault('HTTP 400 invalid email'), 'MALFORMED_PAYLOAD_400');
    assert.equal(classifyFault('HTTP 503 throttled'), 'IP_THROTTLED_503');
  });
});
