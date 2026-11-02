import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryDispatchStore } from '../lib/dispatch/store-memory';
import { dispatchCampaign } from '../lib/dispatch/courier';
import { unboundE10Clearance, unboundE20Go } from '../lib/dispatch/providers';
import { unboundPlatformSuppression } from '../lib/compliance/suppression';
import { ingestAndProcess, ingestSignal, processSignals, RECIPES } from '../lib/mesh/orchestrator';
import { MemoryMeshStore } from '../lib/mesh/store-memory';
import { AGENCY_ID, DEMO_SILO, demoState } from './fixtures';

const NOW = new Date('2026-10-15T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

const courierDeps = (store: MemoryDispatchStore) => ({
  store, e20: unboundE20Go, e10: unboundE10Clearance, platformSuppression: unboundPlatformSuppression,
  transport: null, unsubscribeSecret: 'test-unsubscribe-secret-0123456789abcdef', baseUrl: 'https://example.org',
  requestedMode: 'DRY_RUN' as const, edLiveOrder: undefined, now: () => NOW, log: () => undefined,
});

describe('mesh orchestrator', () => {
  it('routes a nova-evaluate signal into a feeder verdict and proposal', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(3) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(4) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'e59-heat', signalType: 'HEAT_SPIKE', recipeKey: 'nova-evaluate', goal: 'HighValueConversionPropensity', enabled: true,
    });

    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'e59-heat', type: 'HEAT_SPIKE', payload: { subscriberId: 'sub-ada', heat: 0.9 },
    }, NOW);

    assert.equal(report.consumed.length, 1);
    assert.equal(report.consumed[0]!.recipes[0]!.recipeKey, 'nova-evaluate');
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /verdict=loyal/);
    const verdict = state.feederVerdicts.find((v) => v.subscriberId === 'sub-ada');
    assert.equal(verdict?.verdict.affinity, 'LOYAL');
    assert.equal(state.feederProposals[0]?.action, 'HIGH_INTENT_CONVERSION');
    // Signal was consumed — a second process run is a no-op.
    const second = await processSignals(store, DEMO_SILO, NOW);
    assert.equal(second.consumed.length, 0);
    assert.equal(state.feederVerdicts.length, 1);
  });

  it('fatigue guard downgrades conversion to nurture when the weekly cap is met', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(3) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(4) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(3) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(4) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(5) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'e59-heat', signalType: 'HEAT_SPIKE', recipeKey: 'nova-evaluate', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'e59-heat', type: 'HEAT_SPIKE', payload: { subscriberId: 'sub-ada' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /fatigued/);
    const verdict = state.feederVerdicts.find((v) => v.subscriberId === 'sub-ada')!;
    assert.equal(verdict.verdict.affinity, 'LOYAL');
    assert.equal(verdict.verdict.action, 'NURTURE'); // conversion downgraded
    assert.match(verdict.verdict.reason, /fatigue-guard/);
    assert.equal(verdict.verdict.tone, 'direct_ask'); // tone layer still recorded
  });

  it('perspective-ingest turns a funnel event into activity + rescore', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'perspective-io', signalType: 'FUNNEL_EVENT', recipeKey: 'perspective-ingest', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'perspective-io', type: 'FUNNEL_EVENT',
      payload: { funnelId: 'fn-1', stepName: 'pricing-page', eventType: 'step_completed', email: 'ada@example.com' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /activity=CLICKED funnel=fn-1 step=pricing-page/);
    const activity = state.activities.find((a) => a.subscriberId === 'sub-ada' && a.type === 'CLICKED')!;
    assert.ok(activity);
    // the new click rescores the subscriber through the feeder
    assert.ok(state.feederVerdicts.some((v) => v.subscriberId === 'sub-ada'));
  });

  it('perspective-ingest skips contacts that are not in the silo', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'perspective-io', signalType: 'FUNNEL_EVENT', recipeKey: 'perspective-ingest', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'perspective-io', type: 'FUNNEL_EVENT',
      payload: { funnelId: 'fn-1', stepName: 's', eventType: 'step_completed', email: 'stranger@example.com' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /email not found in silo/);
    assert.equal(state.activities.filter((a) => a.candidateId === DEMO_SILO).length, 0);
  });

  it('intent-boost records engagement and rescores on a hot intent signal', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'breeze-intelligence', signalType: 'BUYER_INTENT', recipeKey: 'intent-boost', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'breeze-intelligence', type: 'BUYER_INTENT',
      payload: { email: 'ada@example.com', intentScore: 0.82, source: 'pricing-page-visits' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /intent=0\.82.*\+CLICKED/);
    assert.ok(state.activities.some((a) => a.subscriberId === 'sub-ada' && a.type === 'CLICKED'));
    // cold intent records no engagement but still rescores
    const report2 = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'breeze-intelligence', type: 'BUYER_INTENT',
      payload: { email: 'ada@example.com', intentScore: 0.2, source: 'newsletter-skim' },
    }, NOW);
    assert.match(report2.consumed[0]!.recipes[0]!.receipt, /intent=0\.20/);
    assert.equal(state.activities.filter((a) => a.subscriberId === 'sub-ada' && a.type === 'CLICKED').length, 1);
  });

  it('enrich stamps recovered fields onto the silo subscriber only', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'breeze-data-agent', signalType: 'ENRICHED', recipeKey: 'enrich', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'breeze-data-agent', type: 'ENRICHED',
      payload: { email: 'ada@example.com', fields: { phone: '336-555-0100', company: 'Broyhill', employer: 'BH' } },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /enriched/);
    const ada = state.subscribers.find((s) => s.subscriberId === 'sub-ada')!;
    assert.equal(ada.phone, '336-555-0100');
    assert.equal(ada.enrichment?.company, 'Broyhill');
    assert.equal(ada.enrichment?.employer, 'BH');
  });

  it('draft-content files a tone-registered draft proposal for approval', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'breeze-content-agent', signalType: 'DRAFT_REQUEST', recipeKey: 'draft-content', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'breeze-content-agent', type: 'DRAFT_REQUEST',
      payload: { topic: 'the fall matching drive', goal: 'HighValueConversionPropensity', tone: 'direct_ask', subscriberId: 'sub-ada' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /draft filed \[direct_ask\]/);
    const proposal = state.feederProposals.find((p) => p.subscriberId === 'sub-ada')!;
    assert.equal(proposal.status, 'PENDING_APPROVAL');
    assert.equal(proposal.tone, 'direct_ask');
    assert.match(proposal.reason, /fall matching drive/);
  });

  it('follow-up maps engagement events to the right proposal', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'dispatch', signalType: 'SUBSCRIBER_EVENT', recipeKey: 'follow-up', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'dispatch', type: 'SUBSCRIBER_EVENT',
      payload: { subscriberId: 'sub-ada', activityType: 'CLICKED', campaignId: 'cmp-1' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /follow-up filed \[clicked→HIGH_INTENT_CONVERSION\]/);
    const report2 = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'dispatch', type: 'SUBSCRIBER_EVENT',
      payload: { subscriberId: 'sub-bo', activityType: 'BOUNCED', campaignId: 'cmp-1' },
    }, NOW);
    const bounceProposal = state.feederProposals.find((p) => p.subscriberId === 'sub-bo')!;
    assert.equal(bounceProposal.action, 'SUPPRESS');
  });

  it('ticket-log files a prioritized issue proposal', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'crm', signalType: 'ISSUE', recipeKey: 'ticket-log', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'crm', type: 'ISSUE', payload: { email: 'bo@example.com', issue: 'Payment link in the quote email 404s', priority: 'high' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /ticket\[high\]: Payment link.*sub-bo/);
    const prop = state.feederProposals.find((p) => /ticket\[high\]/.test(p.reason))!;
    assert.equal(prop.subscriberId, 'sub-bo');
    assert.equal(prop.tone, 'apology_winback');
  });

  it('hygiene-scan reports record completeness gaps', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.enrichSubscriber(DEMO_SILO, 'sub-ada', { company: 'Acme' });
    // bo/cy/di have firstName but no company; all have a name → missingName=0
    const blank = state.subscribers.find((s) => s.subscriberId === 'sub-di')!;
    blank.firstName = null; blank.lastName = null;
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'data-hub', signalType: 'HYGIENE_SWEEP', recipeKey: 'hygiene-scan', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'data-hub', type: 'HYGIENE_SWEEP', payload: {},
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /hygiene-scan: 4 records — 1 missing name, 3 missing company/);
  });

  it('stall-scan flags engaged contacts who went cold', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(30) }, // cold
      { candidateId: DEMO_SILO, subscriberId: 'sub-bo', type: 'OPENED', occurredAt: daysAgo(20) },  // cold
      { candidateId: DEMO_SILO, subscriberId: 'sub-cy', type: 'CLICKED', occurredAt: daysAgo(2) },  // warm
      { candidateId: DEMO_SILO, subscriberId: 'sub-di', type: 'DELIVERED', occurredAt: daysAgo(30) }, // never engaged
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'sales-hub', signalType: 'STALL_SWEEP', recipeKey: 'stall-scan', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'sales-hub', type: 'STALL_SWEEP', payload: { stallDays: 14 },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /stall-scan: 2 cold contacts flagged/);
    const proposal = state.feederProposals.find((p) => p.reason.startsWith('stall-scan:'))!;
    assert.match(proposal.reason, /sub-ada/);
    assert.match(proposal.reason, /sub-bo/);
    assert.doesNotMatch(proposal.reason, /sub-cy|sub-di/); // warm and never-engaged are not "going cold"
    assert.equal(proposal.tone, 'apology_winback');
  });

  it('dedupe-scan surfaces collision sets without merging anything', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.enrichSubscriber(DEMO_SILO, 'sub-ada', { firstName: 'Sam', lastName: 'Carter' });
    await store.enrichSubscriber(DEMO_SILO, 'sub-bo', { firstName: 'sam', lastName: 'carter' });
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'starter', signalType: 'DEDUPE_SWEEP', recipeKey: 'dedupe-scan', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'starter', type: 'DEDUPE_SWEEP', payload: {},
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /dedupe-scan: \d+ collision set/);
    const proposal = state.feederProposals.find((p) => p.reason.startsWith('dedupe-scan:'))!;
    assert.match(proposal.reason, /name:sam carter → sub-ada, sub-bo/);
    // nothing merged — records are untouched
    assert.equal(state.subscribers.length, 5);
  });

  it('form-capture scores known contacts and proposes new leads for strangers', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'starter', signalType: 'FORM_SUBMIT', recipeKey: 'form-capture', goal: null, enabled: true,
    });
    const known = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'starter', type: 'FORM_SUBMIT',
      payload: { email: 'ada@example.com', source: 'spring-gala' },
    }, NOW);
    assert.match(known.consumed[0]!.recipes[0]!.receipt, /captured ada@example\.com via spring-gala \| verdict=/);
    assert.ok(state.activities.some((a) => a.subscriberId === 'sub-ada' && a.type === 'CAPTURED'));
    const stranger = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'starter', type: 'FORM_SUBMIT',
      payload: { email: 'newdonor@example.com' },
    }, NOW);
    assert.equal(stranger.consumed[0]!.recipes[0]!.receipt, 'new lead proposed: newdonor@example.com');
    const lead = state.feederProposals.find((p) => p.reason.includes('newdonor@example.com'))!;
    assert.equal(lead.status, 'PENDING_APPROVAL');
    // a foreign-silo email is a stranger here, not a write
    const foreign = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'starter', type: 'FORM_SUBMIT', payload: { email: 'eve@example.com' },
    }, NOW);
    assert.equal(foreign.consumed[0]!.recipes[0]!.receipt, 'new lead proposed: eve@example.com');
    assert.ok(!state.activities.some((a) => a.subscriberId === 'sub-eve'));
  });

  it('gate-check confirms members and proposes access for non-members', async () => {
    const state = demoState();
    // fixture: all five subs are on list-1; add a gated list only ada holds
    state.listMembers.push({ listId: 'list-vip', subscriberId: 'sub-ada' });
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'content-hub', signalType: 'GATED_ACCESS', recipeKey: 'gate-check', goal: null, enabled: true,
    });
    const member = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'content-hub', type: 'GATED_ACCESS',
      payload: { email: 'ada@example.com', listId: 'list-vip' },
    }, NOW);
    assert.match(member.consumed[0]!.recipes[0]!.receipt, /member of list-vip/);
    const outsider = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'content-hub', type: 'GATED_ACCESS',
      payload: { email: 'bo@example.com', listId: 'list-vip' },
    }, NOW);
    assert.match(outsider.consumed[0]!.recipes[0]!.receipt, /not a member of list-vip, access proposal filed/);
    const proposal = state.feederProposals.find((p) => p.subscriberId === 'sub-bo' && p.reason.startsWith('gate-check:'))!;
    assert.equal(proposal.status, 'PENDING_APPROVAL'); // never auto-granted
  });

  it('remix files one draft proposal per requested format', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'content-hub', signalType: 'REMIX', recipeKey: 'remix', goal: null, enabled: true,
    });
    const source = 'The fall matching drive doubles every gift through December 31.'.padEnd(200, ' Give today.');
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'content-hub', type: 'REMIX',
      payload: { text: source, formats: ['sms', 'social', 'telegram'] },
    }, NOW);
    assert.equal(report.consumed[0]!.recipes[0]!.receipt, 'remix filed: sms, social');
    const drafts = state.feederProposals.filter((p) => p.reason.startsWith('remix['));
    assert.equal(drafts.length, 2);
    assert.ok(drafts.every((p) => p.status === 'PENDING_APPROVAL'));
    const sms = drafts.find((p) => p.reason.startsWith('remix[sms]'))!;
    assert.ok(sms.reason.length <= 175); // 160c clip + prefix
  });

  it('smart-property writes an engagement summary onto the record', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(3) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(1) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'data-agent', signalType: 'REFRESH_PROPERTY', recipeKey: 'smart-property', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'data-agent', type: 'REFRESH_PROPERTY',
      payload: { email: 'ada@example.com', property: 'engagement_summary', windowDays: 30 },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /smart-property engagement_summary="last=CLICKED@/);
    const sub = state.subscribers.find((s) => s.subscriberId === 'sub-ada')!;
    assert.match(sub.enrichment!.engagement_summary!, /clicked=1 delivered=1 opened=1/);
    // dormant subscriber: record untouched
    const quiet = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'data-agent', type: 'REFRESH_PROPERTY',
      payload: { subscriberId: 'sub-bo', property: 'engagement_summary' },
    }, NOW);
    assert.match(quiet.consumed[0]!.recipes[0]!.receipt, /record untouched/);
  });

  it('committee sources the buying committee from enriched company fields', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.enrichSubscriber(DEMO_SILO, 'sub-ada', { company: 'Acme Corp' });
    await store.enrichSubscriber(DEMO_SILO, 'sub-bo', { company: 'acme corp' });
    await store.enrichSubscriber(DEMO_SILO, 'sub-cy', { company: 'Globex' });
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'prospecting-agent', signalType: 'COMMITTEE_SCAN', recipeKey: 'committee', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'prospecting-agent', type: 'COMMITTEE_SCAN', payload: { company: 'Acme Corp' },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /committee@acme corp: 2 contacts/);
    const empty = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'prospecting-agent', type: 'COMMITTEE_SCAN', payload: { company: 'Initech' },
    }, NOW);
    assert.match(empty.consumed[0]!.recipes[0]!.receipt, /no contacts at initech/);
  });

  it('enroll puts a triggered contact into a journey run, idempotently', async () => {
    const state = demoState();
    state.journeys.push({ id: 'jrn-winback', candidateId: DEMO_SILO, name: 'winback' });
    state.journeys.push({ id: 'jrn-other-silo', candidateId: 'sil-b', name: 'foreign' });
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'marketing-hub', signalType: 'LINK_CLICKED', recipeKey: 'enroll', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'marketing-hub', type: 'LINK_CLICKED',
      payload: { email: 'ada@example.com', journeyId: 'jrn-winback' },
    }, NOW);
    assert.equal(report.consumed[0]!.recipes[0]!.receipt, 'enrolled');
    assert.deepEqual(state.journeyRuns, [{ journeyId: 'jrn-winback', candidateId: DEMO_SILO, subscriberId: 'sub-ada' }]);
    // re-fire the trigger: no second run
    const again = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'marketing-hub', type: 'LINK_CLICKED',
      payload: { email: 'ada@example.com', journeyId: 'jrn-winback' },
    }, NOW);
    assert.equal(again.consumed[0]!.recipes[0]!.receipt, 'already-enrolled');
    // a foreign silo's journey can never be entered
    const foreign = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'marketing-hub', type: 'LINK_CLICKED',
      payload: { email: 'ada@example.com', journeyId: 'jrn-other-silo' },
    }, NOW);
    assert.equal(foreign.consumed[0]!.recipes[0]!.receipt, 'unknown-journey');
    assert.equal(state.journeyRuns.length, 1);
  });

  it('retarget finds non-openers, enrolls them, and reports the count', async () => {
    const state = demoState();
    state.journeys.push({ id: 'jrn-retarget', candidateId: DEMO_SILO, name: 'retarget' });
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-bo', type: 'DELIVERED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-cy', type: 'DELIVERED', occurredAt: daysAgo(2) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'marketing-hub', signalType: 'RETARGET_SWEEP', recipeKey: 'retarget', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'marketing-hub', type: 'RETARGET_SWEEP',
      payload: { journeyId: 'jrn-retarget', windowDays: 7 },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /retarget: 2 non-openers in 7d, 2 enrolled/);
    assert.equal(state.journeyRuns.filter((r) => r.journeyId === 'jrn-retarget').length, 2);
    assert.ok(state.journeyRuns.every((r) => r.subscriberId !== 'sub-ada')); // opener never retargeted
    const proposal = state.feederProposals.find((p) => p.reason.startsWith('retarget:'))!;
    assert.equal(proposal.status, 'PENDING_APPROVAL');
  });

  it('lead-alert fires only when the propensity crosses the threshold', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(2) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(3) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'sales-hub', signalType: 'LEAD_CHECK', recipeKey: 'lead-alert', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'sales-hub', type: 'LEAD_CHECK',
      payload: { email: 'ada@example.com', threshold: 0.2 },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /lead alert: \d\.\d+ ≥ 0\.2/);
    const proposal = state.feederProposals.find((p) => p.subscriberId === 'sub-ada')!;
    assert.equal(proposal.action, 'HIGH_INTENT_CONVERSION');
    // cold lead never alerts
    const report2 = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'sales-hub', type: 'LEAD_CHECK',
      payload: { subscriberId: 'sub-bo', threshold: 0.5 },
    }, NOW);
    assert.match(report2.consumed[0]!.recipes[0]!.receipt, /below threshold/);
    assert.ok(!state.feederProposals.some((p) => p.subscriberId === 'sub-bo'));
  });

  it('insights files one engagement-shape proposal per window', async () => {
    const state = demoState();
    state.activities.push(
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'DELIVERED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'OPENED', occurredAt: daysAgo(1) },
      { candidateId: DEMO_SILO, subscriberId: 'sub-ada', type: 'CLICKED', occurredAt: daysAgo(1) },
    );
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'breeze-intelligence', signalType: 'INSIGHT_SWEEP', recipeKey: 'insights', goal: null, enabled: true,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'breeze-intelligence', type: 'INSIGHT_SWEEP', payload: { windowDays: 7 },
    }, NOW);
    assert.match(report.consumed[0]!.recipes[0]!.receipt, /delivered=1 opens=1\(100%\) clicks=1/);
    const proposal = state.feederProposals.find((p) => p.subscriberId === null)!;
    assert.equal(proposal.status, 'PENDING_APPROVAL');
  });

  it('files proposal-only signals and dedupes identical pending advice', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'e60-lp', signalType: 'LP_RESOLVED', recipeKey: 'proposal-only', goal: null, enabled: true,
    });
    const signal = {
      ecosystemKey: 'e60-lp', type: 'LP_RESOLVED',
      payload: { subscriberId: 'sub-bo', action: 'REENGAGEMENT_SUPPRESSION', reason: 'lp: budget cap reached, marginal ROI < 0' },
    };
    const first = await ingestAndProcess(store, DEMO_SILO, signal, NOW);
    assert.match(first.consumed[0]!.recipes[0]!.receipt, /proposal filed/);
    await ingestAndProcess(store, DEMO_SILO, signal, NOW);
    assert.equal(state.feederProposals.length, 1);
    assert.equal(state.feederProposals[0]!.reason, 'lp: budget cap reached, marginal ROI < 0');
  });

  it('skips signals with no enabled route and never leaks across silos', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await ingestSignal(store, DEMO_SILO, { ecosystemKey: 'e42-news', type: 'ISSUE_SPIKE', payload: {} });
    const report = await processSignals(store, DEMO_SILO, NOW);
    assert.equal(report.skipped.length, 1);
    assert.match(report.skipped[0]!.reason, /no enabled route/);

    // A route in silo-b must not consume a signal in silo-a, and a silo-a signal
    // cannot write a verdict onto a silo-b subscriber.
    await store.upsertSignalRoute({
      candidateId: 'silo-broyhillgop', ecosystemKey: 'x', signalType: 'Y', recipeKey: 'nova-evaluate', goal: null, enabled: true,
    });
    await ingestSignal(store, DEMO_SILO, { ecosystemKey: 'x', type: 'Y', payload: { subscriberId: 'sub-eve' } });
    const second = await processSignals(store, DEMO_SILO, NOW);
    assert.equal(second.skipped.length, 1); // no silo-a route for x/Y
    assert.equal(state.feederVerdicts.length, 0);
  });

  it('disabled routes do not fire; dispatch verdicts still land beside mesh verdicts', async () => {
    const state = demoState();
    const store = new MemoryMeshStore(state);
    await store.upsertSignalRoute({
      candidateId: DEMO_SILO, ecosystemKey: 'e59-heat', signalType: 'HEAT_SPIKE', recipeKey: 'nova-evaluate', goal: null, enabled: false,
    });
    const report = await ingestAndProcess(store, DEMO_SILO, {
      ecosystemKey: 'e59-heat', type: 'HEAT_SPIKE', payload: { subscriberId: 'sub-ada' },
    }, NOW);
    assert.equal(report.skipped.length, 1);

    // Dispatch path (PR #8 wiring) still scores recipients alongside the mesh.
    await dispatchCampaign(courierDeps(new MemoryDispatchStore(state)), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 't' });
    assert.deepEqual(
      state.feederVerdicts.map((v) => v.subscriberId).sort(),
      ['sub-ada', 'sub-bo', 'sub-cy', 'sub-di'],
    );
  });
});
