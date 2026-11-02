import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionForBranch,
  computeAffinity,
  evaluateSubscriber,
  frequencyCapPerWeek,
  optimalSendHour,
  percentileOf,
  recommendedBranch,
  scoreGoal,
  sliceForPercentile,
  type FeederActivity,
} from '../lib/feeder/nova';

const NOW = new Date('2026-10-30T12:00:00');
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(NOW.getTime() - n * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const ev = (type: FeederActivity['type'], days: number, hour = 10): FeederActivity => ({ type, occurredAt: daysAgo(days, hour) });

describe('computeAffinity (itblDS.brandAffinityLabel mirror)', () => {
  it('UNSCORED with no activity', () => {
    assert.equal(computeAffinity([], NOW), 'UNSCORED');
  });
  it('NEGATIVE on complaint/unsubscribe', () => {
    assert.equal(computeAffinity([ev('UNSUBSCRIBED', 5)], NOW), 'NEGATIVE');
    assert.equal(computeAffinity([ev('COMPLAINED', 5), ev('OPENED', 5)], NOW), 'NEGATIVE');
  });
  it('NEGATIVE on bounce with zero opens ever', () => {
    assert.equal(computeAffinity([ev('BOUNCED', 3), ev('DELIVERED', 2)], NOW), 'NEGATIVE');
  });
  it('NEGATIVE when stale: delivered long ago, never opened', () => {
    assert.equal(computeAffinity([ev('DELIVERED', 120), ev('DELIVERED', 95)], NOW), 'NEGATIVE');
  });
  it('LOYAL on recent clicks + opens', () => {
    const events = [ev('CLICKED', 3), ev('CLICKED', 5), ev('OPENED', 4), ev('OPENED', 6), ev('DELIVERED', 7)];
    assert.equal(computeAffinity(events, NOW), 'LOYAL');
  });
  it('POSITIVE on recent opens without clicks', () => {
    assert.equal(computeAffinity([ev('OPENED', 4), ev('DELIVERED', 3)], NOW), 'POSITIVE');
  });
  it('NEUTRAL for captured/delivered with no engagement and no staleness', () => {
    assert.equal(computeAffinity([ev('CAPTURED', 2), ev('DELIVERED', 1)], NOW), 'NEUTRAL');
  });
});

describe('scoreGoal (itblDS.<GoalUserFieldName> 0.00-1.00)', () => {
  it('conversion score rises with clicks', () => {
    const cold = scoreGoal([ev('DELIVERED', 1)], 'HighValueConversionPropensity', NOW);
    const hot = scoreGoal([ev('CLICKED', 1), ev('CLICKED', 2), ev('OPENED', 1), ev('DELIVERED', 1)], 'HighValueConversionPropensity', NOW);
    assert.ok(hot > cold);
    assert.ok(hot >= 0 && hot <= 1);
  });
  it('churn risk rises with silence and negative signals', () => {
    const engaged = scoreGoal([ev('OPENED', 1), ev('CLICKED', 1)], 'ChurnRiskPropensity', NOW);
    const silent = scoreGoal([ev('DELIVERED', 100)], 'ChurnRiskPropensity', NOW);
    assert.ok(silent > engaged);
  });
  it('scores stay clamped to 0-1', () => {
    const s = scoreGoal([ev('OPENED', 1), ev('OPENED', 2), ev('CLICKED', 1), ev('CLICKED', 2), ev('DELIVERED', 1)], 'HighValueConversionPropensity', NOW);
    assert.ok(s >= 0 && s <= 1);
  });
});

describe('slices + decisioning', () => {
  it('sliceForPercentile mirrors Iterable buckets', () => {
    assert.equal(sliceForPercentile(95), 'top_10_percent');
    assert.equal(sliceForPercentile(85), 'top_20_percent');
    assert.equal(sliceForPercentile(5), 'bottom_10_percent');
    assert.equal(sliceForPercentile(50), 'p50-60');
  });
  it('percentileOf ranks within cohort', () => {
    assert.equal(percentileOf(0.9, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]), 80);
    assert.equal(percentileOf(0.5, []), 0);
  });
  it('optimalSendHour picks modal engagement hour inside 6-24', () => {
    const events = [ev('OPENED', 1, 21), ev('OPENED', 2, 21), ev('CLICKED', 3, 21), ev('OPENED', 1, 9)];
    assert.equal(optimalSendHour(events), 21);
  });
  it('optimalSendHour defaults to 10 for no engagement', () => {
    assert.equal(optimalSendHour([ev('DELIVERED', 1, 3)]), 10);
  });
  it('frequencyCapPerWeek scales with engagement', () => {
    assert.equal(frequencyCapPerWeek([], NOW), 1);
    const hot = [ev('OPENED', 1), ev('OPENED', 2), ev('OPENED', 3), ev('CLICKED', 1), ev('CLICKED', 2)];
    assert.ok(frequencyCapPerWeek(hot, NOW) >= 3);
  });
});

describe('branch + proposals (recovered-SDK semantics)', () => {
  it('loyal/positive → high_intent_conversion; negative → suppression; else nurture', () => {
    assert.equal(recommendedBranch('LOYAL'), 'high_intent_conversion');
    assert.equal(recommendedBranch('POSITIVE'), 'high_intent_conversion');
    assert.equal(recommendedBranch('NEGATIVE'), 'nova_re_engagement_suppression');
    assert.equal(recommendedBranch('NEUTRAL'), 'nurture');
    assert.equal(actionForBranch('high_intent_conversion'), 'HIGH_INTENT_CONVERSION');
    assert.equal(actionForBranch('nova_re_engagement_suppression'), 'REENGAGEMENT_SUPPRESSION');
    assert.equal(actionForBranch('nurture'), 'NURTURE');
  });
  it('evaluateSubscriber returns explainable verdict with reason', () => {
    const v = evaluateSubscriber([ev('CLICKED', 2), ev('CLICKED', 4), ev('OPENED', 3), ev('OPENED', 5), ev('DELIVERED', 6)], NOW);
    assert.equal(v.affinity, 'LOYAL');
    assert.equal(v.action, 'HIGH_INTENT_CONVERSION');
    assert.match(v.reason, /affinity=loyal/);
    assert.match(v.reason, /→ high_intent_conversion/);
    assert.ok(v.sendTimeOptimalHour >= 6 && v.sendTimeOptimalHour < 24);
    assert.ok(v.frequencyCapPerWeek >= 1 && v.frequencyCapPerWeek <= 5);
  });
});
