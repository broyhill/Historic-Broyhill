// AI funnel feeder — Nova taxonomy (Iterable itblDS mirror).
// Deterministic scoring over a silo's SubscriberActivity: affinity labels, predictive-goal
// propensity scores (0.00-1.00), segmentation slices, and Nova Decisioning outputs
// (send-time hour, frequency cap, channel preference). Every score is explainable — the
// reason strings written into FunnelProposal are the why-vectors the Braze doctrine
// requires. No black box; a model can replace these heuristics later without changing
// the schema or the proposal contract.

export type BrandAffinityLabel = 'LOYAL' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'UNSCORED';

export type FeederActivity = {
  type: 'CAPTURED' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED';
  occurredAt: Date;
};

export type FunnelAction =
  | 'HIGH_INTENT_CONVERSION'
  | 'NURTURE'
  | 'REENGAGEMENT_SUPPRESSION'
  | 'SUPPRESS';

export const SEND_TIME_WINDOW = { startHour: 6, endHour: 24 } as const;
export const PRODUCED_GOALS = ['HighValueConversionPropensity', 'ChurnRiskPropensity'] as const;
export type PropensityGoal = (typeof PRODUCED_GOALS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 30;
const STALE_DAYS = 90;

function inLastDays(d: Date, days: number, now: Date): boolean {
  return now.getTime() - d.getTime() <= days * DAY_MS;
}

function count(events: FeederActivity[], type: FeederActivity['type'], days: number | null, now: Date): number {
  return events.filter((e) => e.type === type && (days === null || inLastDays(e.occurredAt, days, now))).length;
}

// itblDS.brandAffinityLabel mirror:
//   NEGATIVE — complaint/unsubscribe/bounce, or stale (no opens in 90d with delivered mail)
//   LOYAL    — clicked recently AND opens regularly
//   POSITIVE — opens recently, no recent clicks
//   NEUTRAL  — receives mail, no engagement either way
//   UNSCORED — no activity yet
export function computeAffinity(events: FeederActivity[], now: Date = new Date()): BrandAffinityLabel {
  if (events.length === 0) return 'UNSCORED';
  if (count(events, 'COMPLAINED', null, now) > 0 || count(events, 'UNSUBSCRIBED', null, now) > 0) return 'NEGATIVE';
  if (count(events, 'BOUNCED', null, now) > 0 && count(events, 'OPENED', null, now) === 0) return 'NEGATIVE';
  const recentClicks = count(events, 'CLICKED', RECENT_DAYS, now);
  const recentOpens = count(events, 'OPENED', RECENT_DAYS, now);
  if (recentClicks >= 2 || (recentClicks >= 1 && recentOpens >= 3)) return 'LOYAL';
  if (recentOpens >= 1) return 'POSITIVE';
  const delivered = count(events, 'DELIVERED', null, now);
  const anyOpens = count(events, 'OPENED', null, now);
  if (delivered > 0 && anyOpens === 0) {
    const lastDelivered = Math.max(...events.filter((e) => e.type === 'DELIVERED').map((e) => e.occurredAt.getTime()));
    if (now.getTime() - lastDelivered > STALE_DAYS * DAY_MS) return 'NEGATIVE';
  }
  if (delivered > 0 || count(events, 'CAPTURED', null, now) > 0) return 'NEUTRAL';
  return 'UNSCORED';
}

// itblDS.<GoalUserFieldName> mirror: a 0.00-1.00 propensity per named goal.
export function scoreGoal(events: FeederActivity[], goal: PropensityGoal, now: Date = new Date()): number {
  const opens = count(events, 'OPENED', RECENT_DAYS, now);
  const clicks = count(events, 'CLICKED', RECENT_DAYS, now);
  const delivered = count(events, 'DELIVERED', RECENT_DAYS, now);
  const negative = count(events, 'COMPLAINED', null, now) + count(events, 'UNSUBSCRIBED', null, now) + count(events, 'BOUNCED', null, now);

  if (goal === 'HighValueConversionPropensity') {
    // engagement ratio weighted toward clicks; decays with negative signals
    const base = delivered === 0 ? 0 : Math.min(1, (clicks * 0.5 + opens * 0.15) / Math.max(1, delivered));
    const lift = Math.min(0.5, clicks * 0.1 + opens * 0.02);
    return clamp01(base + lift - negative * 0.3);
  }
  // ChurnRiskPropensity: staleness + negative signals drive the score
  const lastActivity = events.length ? Math.max(...events.map((e) => e.occurredAt.getTime())) : 0;
  const daysSilent = lastActivity === 0 ? STALE_DAYS : (now.getTime() - lastActivity) / DAY_MS;
  const staleComponent = Math.min(1, daysSilent / STALE_DAYS);
  return clamp01(staleComponent * 0.6 + negative * 0.2);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

// Iterable segmentation slices: top_10_percent / top_20_percent / bottom_10_percent.
export function sliceForPercentile(percentile: number): string {
  if (percentile >= 90) return 'top_10_percent';
  if (percentile >= 80) return 'top_20_percent';
  if (percentile <= 10) return 'bottom_10_percent';
  return `p${Math.floor(percentile / 10) * 10}-${Math.floor(percentile / 10) * 10 + 10}`;
}

// Percentile rank of a score within a cohort (0-100, higher = better rank).
export function percentileOf(score: number, cohort: number[]): number {
  if (cohort.length === 0) return 0;
  const below = cohort.filter((s) => s < score).length;
  return Math.round((below / cohort.length) * 100);
}

// Nova SendTime Decisioning: the local hour (inside the 6h-24h window) with the most
// opens+clicks. Falls back to 10:00 — the neutral default inside the window.
export function optimalSendHour(events: FeederActivity[]): number {
  const counts = new Array(24).fill(0) as number[];
  for (const e of events) {
    if (e.type === 'OPENED' || e.type === 'CLICKED') counts[e.occurredAt.getHours()] = (counts[e.occurredAt.getHours()] ?? 0) + 1;
  }
  let bestHour = 10;
  let best = 0;
  for (let h = SEND_TIME_WINDOW.startHour; h < SEND_TIME_WINDOW.endHour; h++) {
    const c = counts[h] ?? 0;
    if (c > best) {
      best = c;
      bestHour = h;
    }
  }
  return bestHour;
}

// Nova Frequency Decisioning: cap = recent-engagement-scaled sends per 7 days.
// Loyal engagers tolerate more; cold contacts get the floor.
export function frequencyCapPerWeek(events: FeederActivity[], now: Date = new Date()): number {
  const recent = count(events, 'OPENED', RECENT_DAYS, now) + count(events, 'CLICKED', RECENT_DAYS, now) * 2;
  if (recent >= 6) return 5;
  if (recent >= 3) return 3;
  if (recent >= 1) return 2;
  return 1;
}

// Recovered-SDK recommendedBranch verbatim semantics.
export function recommendedBranch(affinity: BrandAffinityLabel): 'high_intent_conversion' | 'nova_re_engagement_suppression' | 'nurture' {
  if (affinity === 'LOYAL' || affinity === 'POSITIVE') return 'high_intent_conversion';
  if (affinity === 'NEGATIVE') return 'nova_re_engagement_suppression';
  return 'nurture';
}

export function actionForBranch(branch: ReturnType<typeof recommendedBranch>): FunnelAction {
  switch (branch) {
    case 'high_intent_conversion':
      return 'HIGH_INTENT_CONVERSION';
    case 'nova_re_engagement_suppression':
      return 'REENGAGEMENT_SUPPRESSION';
    default:
      return 'NURTURE';
  }
}

export type FeederVerdict = {
  affinity: BrandAffinityLabel;
  scores: Record<PropensityGoal, number>;
  sendTimeOptimalHour: number;
  frequencyCapPerWeek: number;
  branch: ReturnType<typeof recommendedBranch>;
  action: FunnelAction;
  tone: string;
  reason: string;
};

// AI tone layer (IFTTT brain): the register the proposal should speak in.
export function toneFor(affinity: BrandAffinityLabel): string {
  switch (affinity) {
    case 'LOYAL': return 'direct_ask';
    case 'POSITIVE': return 'warm_ask';
    case 'NEGATIVE': return 'apology_winback';
    default: return 'nurture';
  }
}

// Customer-fatigue layer: if sends in the last 7 days already meet the subscriber's
// weekly cap, a conversion push is downgraded to nurture. Saturation beats eagerness —
// a fatigued loyalist unsubscribes.
export function fatigueGuard(events: FeederActivity[], verdict: FeederVerdict, now: Date = new Date()): { action: FunnelAction; fatigued: boolean } {
  if (verdict.action !== 'HIGH_INTENT_CONVERSION') return { action: verdict.action, fatigued: false };
  const sendsLastWeek = count(events, 'DELIVERED', 7, now);
  const fatigued = sendsLastWeek >= verdict.frequencyCapPerWeek;
  return { action: fatigued ? 'NURTURE' : verdict.action, fatigued };
}

export function evaluateSubscriber(events: FeederActivity[], now: Date = new Date()): FeederVerdict {
  const affinity = computeAffinity(events, now);
  const scores = {
    HighValueConversionPropensity: scoreGoal(events, 'HighValueConversionPropensity', now),
    ChurnRiskPropensity: scoreGoal(events, 'ChurnRiskPropensity', now),
  };
  const branch = recommendedBranch(affinity);
  const sendHour = optimalSendHour(events);
  const freq = frequencyCapPerWeek(events, now);
  const action = actionForBranch(branch);
  const tone = toneFor(affinity);
  const reason =
    `affinity=${affinity.toLowerCase()} ` +
    `hv=${scores.HighValueConversionPropensity.toFixed(2)} churn=${scores.ChurnRiskPropensity.toFixed(2)} ` +
    `sendHour=${sendHour} freqCap=${freq}/wk tone=${tone} → ${branch}`;
  return { affinity, scores, sendTimeOptimalHour: sendHour, frequencyCapPerWeek: freq, branch, action, tone, reason };
}
