import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { advance, newRun, shouldEnroll, WELCOME_JOURNEY, type JourneyFacts } from '../lib/journeys/runner';

const t0 = new Date('2026-10-15T12:00:00Z');
const hours = (n: number) => new Date(t0.getTime() + n * 3_600_000);
const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({ vipScore: 85, phone: '+13365550100', engagedSince: () => false, ...over });

describe('48-hour engagement journey (E41: stages, never fires)', () => {
  it('enrolls only at or above the VIP threshold', () => {
    assert.equal(shouldEnroll(WELCOME_JOURNEY, 'LEAD_CAPTURED', { vipScore: 70 }), true);
    assert.equal(shouldEnroll(WELCOME_JOURNEY, 'LEAD_CAPTURED', { vipScore: 69 }), false);
  });

  it('stages the welcome email, waits 48h, then stages an SMS for an unengaged lead with a phone', () => {
    const start = advance(WELCOME_JOURNEY, newRun(), facts(), t0);
    assert.deepEqual(start.effects, [{ kind: 'STAGE_EMAIL_DRAFT', purpose: 'WELCOME' }]);
    assert.equal(start.run.state, 'WAITING');
    assert.equal(start.run.nextEvalAt?.toISOString(), hours(48).toISOString());

    const early = advance(WELCOME_JOURNEY, start.run, facts(), hours(47));
    assert.deepEqual(early.effects, []);
    assert.equal(early.run.state, 'WAITING');

    const due = advance(WELCOME_JOURNEY, start.run, facts(), hours(48));
    assert.deepEqual(due.effects, [{ kind: 'STAGE_SMS_DRAFT', purpose: 'FOLLOW_UP' }]);
    assert.equal(due.run.state, 'COMPLETED');
  });

  it('exits without an SMS when the lead engaged or has no phone', () => {
    const start = advance(WELCOME_JOURNEY, newRun(), facts(), t0).run;
    const engaged = advance(WELCOME_JOURNEY, start, facts({ engagedSince: () => true }), hours(49));
    assert.deepEqual([engaged.effects, engaged.run.state], [[], 'EXITED']);
    const noPhone = advance(WELCOME_JOURNEY, start, facts({ phone: null }), hours(49));
    assert.deepEqual([noPhone.effects, noPhone.run.state], [[], 'EXITED']);
  });

  it('is inert once finished', () => {
    const done = advance(WELCOME_JOURNEY, { ...newRun(), state: 'COMPLETED' }, facts(), hours(100));
    assert.deepEqual(done.effects, []);
  });
});
