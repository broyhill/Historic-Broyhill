import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkSuppression, levelForEvent, mergeLevel, type SuppressionRow } from '../lib/compliance/suppression';
import { createUnsubscribeToken, listUnsubscribeHeaders, verifyUnsubscribeToken } from '../lib/compliance/unsubscribe';
import { exitGateMissing, exactRncRegId, normalizeEmail } from '../lib/identity';
import { parseCaptureInput } from '../lib/services/capture';
import { planForEvent, signSvix, verifySvix } from '../lib/webhooks/resend';
import { guardDraft, deterministicComposer, forgeDraft } from '../lib/orchestration/forge';

const rows: SuppressionRow[] = [
  { email: 'bulk@example.com', level: 'BULK_ONLY', reason: 'unsubscribe', scope: 'SILO' },
  { email: 'dead@example.com', level: 'ALL_EMAIL', reason: 'hard bounce', scope: 'GLOBAL' },
];

describe('suppression', () => {
  it('bulk suppression never blocks event invitations or personal contact', () => {
    assert.equal(checkSuppression('bulk@example.com', 'BULK', rows).suppressed, true);
    assert.equal(checkSuppression('bulk@example.com', 'EVENT_INVITATION', rows).suppressed, false);
    assert.equal(checkSuppression('bulk@example.com', 'PERSONAL', rows).suppressed, false);
  });
  it('all-email suppression blocks every class and matches exactly after normalization', () => {
    for (const cls of ['BULK', 'EVENT_INVITATION', 'PERSONAL', 'TRANSACTIONAL'] as const) {
      assert.equal(checkSuppression(' DEAD@example.COM ', cls, rows).suppressed, true);
    }
    assert.equal(checkSuppression('dead@example.co', 'BULK', rows).suppressed, false); // exact, never fuzzy
  });
  it('fails closed on an unparseable address', () => {
    assert.equal(checkSuppression('nope', 'PERSONAL', []).suppressed, true);
  });
  it('escalates, never downgrades', () => {
    assert.equal(mergeLevel('ALL_EMAIL', 'BULK_ONLY'), 'ALL_EMAIL');
    assert.equal(mergeLevel('BULK_ONLY', 'ALL_EMAIL'), 'ALL_EMAIL');
    assert.equal(mergeLevel(undefined, 'BULK_ONLY'), 'BULK_ONLY');
    assert.equal(levelForEvent('HARD_BOUNCE'), 'ALL_EMAIL');
    assert.equal(levelForEvent('COMPLAINT'), 'BULK_ONLY');
  });
});

describe('one-click unsubscribe', () => {
  const secret = 'test-unsubscribe-secret-0123456789abcdef';
  it('round-trips and carries no email address', async () => {
    const token = await createUnsubscribeToken('silo-1', 'sub-1', secret);
    assert.deepEqual(await verifyUnsubscribeToken(token, secret), { siloId: 'silo-1', subscriberId: 'sub-1' });
    assert.doesNotMatch(Buffer.from(token.split('.')[0]!, 'base64url').toString(), /@/);
  });
  it('rejects tampering and the wrong secret', async () => {
    const token = await createUnsubscribeToken('silo-1', 'sub-1', secret);
    const [body, sig] = token.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ v: 1, s: 'silo-1', u: 'sub-2' })).toString('base64url');
    assert.equal(await verifyUnsubscribeToken(`${forged}.${sig}`, secret), null);
    assert.equal(await verifyUnsubscribeToken(`${body}.${sig}`, 'another-secret-0123456789abcdefghij'), null);
    assert.equal(await verifyUnsubscribeToken('garbage', secret), null);
  });
  it('emits RFC 8058 headers with an https/http URI', () => {
    const h = listUnsubscribeHeaders('https://example.org/api/unsubscribe?silo=a&token=t');
    assert.equal(h['List-Unsubscribe'], '<https://example.org/api/unsubscribe?silo=a&token=t>');
    assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  });
});

describe('Resend webhook', () => {
  const secret = `whsec_${Buffer.from('webhook-test-secret').toString('base64')}`;
  it('verifies Svix signatures and rejects tampering and stale timestamps', async () => {
    const body = '{"type":"email.delivered"}';
    const sig = await signSvix(secret, 'msg_1', '1000', body);
    assert.equal(await verifySvix({ id: 'msg_1', timestamp: '1000', signature: sig }, body, secret, 1000), true);
    assert.equal(await verifySvix({ id: 'msg_1', timestamp: '1000', signature: `v1,bogus ${sig}` }, body, secret, 1000), true);
    assert.equal(await verifySvix({ id: 'msg_1', timestamp: '1000', signature: sig }, `${body} `, secret, 1000), false);
    assert.equal(await verifySvix({ id: 'msg_1', timestamp: '1000', signature: sig }, body, secret, 1000 + 301), false);
    assert.equal(await verifySvix({ id: null, timestamp: '1000', signature: sig }, body, secret, 1000), false);
  });
  it('maps events and suppresses on hard bounce and complaint only', () => {
    const hard = planForEvent({ type: 'email.bounced', data: { email_id: 'm', to: ['A@Example.com'], bounce: { type: 'Permanent' } } });
    assert.deepEqual([hard[0]?.email, hard[0]?.type, hard[0]?.suppression?.level], ['a@example.com', 'BOUNCED', 'ALL_EMAIL']);
    const soft = planForEvent({ type: 'email.bounced', data: { email_id: 'm', to: 'a@example.com', bounce: { type: 'Transient' } } });
    assert.equal(soft[0]?.suppression, null);
    const complaint = planForEvent({ type: 'email.complained', data: { to: ['a@example.com'] } });
    assert.equal(complaint[0]?.suppression?.level, 'BULK_ONLY');
    assert.equal(planForEvent({ type: 'email.opened', data: { to: ['a@example.com'] } })[0]?.suppression, null);
    assert.deepEqual(planForEvent({ type: 'email.sent', data: { to: ['a@example.com'] } }), []);
  });
});

describe('deterministic identity and capture', () => {
  it('normalizes exactly and never invents RNC_RegID', () => {
    assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
    assert.equal(normalizeEmail('not an email'), null);
    assert.equal(exactRncRegId('  ABC123 '), 'ABC123');
    assert.equal(exactRncRegId('has space'), null);
    assert.deepEqual(exitGateMissing({ rncRegId: null, candidateName: 'X', committeeId: 'C1' }), ['rnc_regid']);
    assert.deepEqual(exitGateMissing({ rncRegId: 'R', candidateName: null, committeeId: null }), ['candidate_name', 'committee_id']);
  });
  it('accepts both capture vocabularies and keeps untrusted posts from setting VIP scores', () => {
    for (const method of ['NFC_TAP', 'QR_PLACARD', 'QR_SIGNAGE', 'WEB_FORM', 'MANUAL']) {
      assert.equal(parseCaptureInput({ candidateSlug: 'demo', email: 'a@example.com', captureMethod: method, vipScore: 90 }, true).captureMethod, method);
    }
    assert.equal(parseCaptureInput({ candidateSlug: 'demo', email: 'a@example.com', captureMethod: 'QR_PLACARD', vipScore: 90 }, false).vipScore, 0);
    assert.throws(() => parseCaptureInput({ candidateSlug: 'demo', email: 'a@example.com', captureMethod: 'NFC_TAP' }, false));
    assert.throws(() => parseCaptureInput({ candidateSlug: 'demo', email: 'nope' }, true));
    assert.throws(() => parseCaptureInput({ candidateSlug: 'demo', email: 'a@example.com', captureMethod: 'TELEPATHY' }, true));
  });
});

describe('Forge guards', () => {
  it('flags leakage, placeholders, internal vocabulary and first-person claims', () => {
    assert.deepEqual(guardDraft('Hello {{firstName}}'), ['MERGE_TAG_LEAKAGE']);
    assert.ok(guardDraft('Call [Your Name]').includes('TEMPLATE_PLACEHOLDER'));
    assert.ok(guardDraft('Your VIP lead score is high').includes('INTERNAL_VOCABULARY'));
    assert.ok(guardDraft('I will vote to fund it').includes('FIRST_PERSON_CLAIM_REQUIRES_APPROVED_LANGUAGE'));
    assert.ok(guardDraft('The Loft seats 200').includes('UNVERIFIED_VENUE_FACT'));
  });
  it('deterministic drafts pass every guard', async () => {
    for (const channel of ['EMAIL', 'SMS'] as const) {
      const draft = await forgeDraft(deterministicComposer, {
        purpose: 'WELCOME', channel,
        silo: { candidateName: 'Demo Candidate', officeSought: null, fromName: 'BroyhillGOP Concierge' },
        recipient: { firstName: 'Ada', venueInterest: 'The Dock' },
      });
      assert.deepEqual(draft.flags, []);
    }
  });
});
