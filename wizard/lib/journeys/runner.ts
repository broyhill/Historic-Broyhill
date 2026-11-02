// Automated lifecycle journeys (Weapon 11). E41's rule holds here: a journey persists state and
// STAGES drafts into the review queue — it never fires. Every staged draft still needs agency
// approval, the candidate's exact-version authorization and every live gate before it can leave.
//
// Track B journey: TRIGGER lead captured (VIP ≥ threshold) → ACTION_EMAIL stage welcome →
// DELAY 48h → CONDITION no open/click since the email and a phone on file → ACTION_SMS stage an
// SMS follow-up for E31 (hooked channel; inert here).

export type JourneyStep =
  | { type: 'TRIGGER'; event: 'LEAD_CAPTURED'; minVipScore: number }
  | { type: 'ACTION_EMAIL'; purpose: 'WELCOME' }
  | { type: 'DELAY'; hours: number }
  | { type: 'CONDITION'; when: 'NO_ENGAGEMENT_SINCE_EMAIL_AND_HAS_PHONE' }
  | { type: 'ACTION_SMS'; purpose: 'FOLLOW_UP' };

export interface JourneyDefinition {
  version: 1;
  steps: JourneyStep[];
}

export const WELCOME_JOURNEY: JourneyDefinition = {
  version: 1,
  steps: [
    { type: 'TRIGGER', event: 'LEAD_CAPTURED', minVipScore: 70 },
    { type: 'ACTION_EMAIL', purpose: 'WELCOME' },
    { type: 'DELAY', hours: 48 },
    { type: 'CONDITION', when: 'NO_ENGAGEMENT_SINCE_EMAIL_AND_HAS_PHONE' },
    { type: 'ACTION_SMS', purpose: 'FOLLOW_UP' },
  ],
};

export function parseJourneyDefinition(input: unknown): JourneyDefinition {
  const raw = input as Partial<JourneyDefinition> | null;
  if (!raw || raw.version !== 1 || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error('journey definition must be { version: 1, steps: [...] }');
  }
  const first = raw.steps[0] as JourneyStep;
  if (first.type !== 'TRIGGER') throw new Error('first step must be TRIGGER');
  for (const step of raw.steps as JourneyStep[]) {
    if (step.type === 'DELAY' && (!Number.isFinite(step.hours) || step.hours <= 0)) throw new Error('DELAY hours must be > 0');
  }
  return raw as JourneyDefinition;
}

export interface RunLogEntry {
  at: string;
  stepIndex: number;
  event: string;
}

export interface RunState {
  stepIndex: number;
  state: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'EXITED';
  nextEvalAt: Date | null;
  log: RunLogEntry[];
}

export interface JourneyFacts {
  vipScore: number;
  phone: string | null;
  // True if the subscriber opened or clicked since the given moment (exact activity rows).
  engagedSince(since: Date): boolean;
}

export type JourneyEffect =
  | { kind: 'STAGE_EMAIL_DRAFT'; purpose: 'WELCOME' }
  | { kind: 'STAGE_SMS_DRAFT'; purpose: 'FOLLOW_UP' };

export function shouldEnroll(definition: JourneyDefinition, event: 'LEAD_CAPTURED', facts: Pick<JourneyFacts, 'vipScore'>): boolean {
  const trigger = definition.steps[0];
  return trigger?.type === 'TRIGGER' && trigger.event === event && facts.vipScore >= trigger.minVipScore;
}

export function newRun(): RunState {
  return { stepIndex: 0, state: 'ACTIVE', nextEvalAt: null, log: [] };
}

function lastEmailStagedAt(run: RunState): Date | null {
  const entry = [...run.log].reverse().find((e) => e.event === 'STAGED_EMAIL_DRAFT');
  return entry ? new Date(entry.at) : null;
}

// Pure state transition. Advances as far as it can at `now`, returning the effects to apply.
// The loop is bounded by the step count, so a malformed definition cannot spin.
export function advance(
  definition: JourneyDefinition,
  current: RunState,
  facts: JourneyFacts,
  now: Date,
): { run: RunState; effects: JourneyEffect[] } {
  const run: RunState = { ...current, log: [...current.log] };
  const effects: JourneyEffect[] = [];
  const note = (event: string) => run.log.push({ at: now.toISOString(), stepIndex: run.stepIndex, event });
  if (run.state === 'COMPLETED' || run.state === 'EXITED') return { run, effects };

  for (let guard = 0; guard <= definition.steps.length; guard++) {
    const step = definition.steps[run.stepIndex];
    if (!step) {
      run.state = 'COMPLETED';
      run.nextEvalAt = null;
      note('COMPLETED');
      break;
    }
    if (step.type === 'TRIGGER') {
      note('TRIGGER_SATISFIED');
      run.stepIndex++;
    } else if (step.type === 'ACTION_EMAIL') {
      effects.push({ kind: 'STAGE_EMAIL_DRAFT', purpose: step.purpose });
      note('STAGED_EMAIL_DRAFT');
      run.stepIndex++;
    } else if (step.type === 'DELAY') {
      if (!run.nextEvalAt) {
        run.nextEvalAt = new Date(now.getTime() + step.hours * 3_600_000);
        run.state = 'WAITING';
        note(`WAIT_UNTIL ${run.nextEvalAt.toISOString()}`);
        break;
      }
      if (now < run.nextEvalAt) break;
      run.nextEvalAt = null;
      run.state = 'ACTIVE';
      note('DELAY_ELAPSED');
      run.stepIndex++;
    } else if (step.type === 'CONDITION') {
      const since = lastEmailStagedAt(run);
      if (since && facts.engagedSince(since)) {
        run.state = 'EXITED';
        note('EXIT_ENGAGED');
        break;
      }
      if (!facts.phone) {
        run.state = 'EXITED';
        note('EXIT_NO_PHONE');
        break;
      }
      note('CONDITION_MET_UNENGAGED_WITH_PHONE');
      run.stepIndex++;
    } else if (step.type === 'ACTION_SMS') {
      effects.push({ kind: 'STAGE_SMS_DRAFT', purpose: step.purpose });
      note('STAGED_SMS_DRAFT_FOR_E31');
      run.stepIndex++;
    }
  }
  return { run, effects };
}
