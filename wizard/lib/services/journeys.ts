// Journey tick: advances due runs in one silo. Stages drafts; never fires (E41 rule).

import type { Prisma, PrismaClient } from '@prisma/client';
import { advance, parseJourneyDefinition, type RunLogEntry, type RunState } from '../journeys/runner';
import type { ForgeComposer } from '../orchestration/forge';
import { applyEffects } from './staging';

export function engagedSinceFor(activities: Array<{ type: string; occurredAt: Date }>) {
  return (since: Date) => activities.some((a) => (a.type === 'OPENED' || a.type === 'CLICKED') && a.occurredAt >= since);
}

export async function runJourneyTick(db: PrismaClient, candidateId: string, composer: ForgeComposer, now = new Date()) {
  const due = await db.journeyRun.findMany({
    where: {
      candidateId,
      journey: { active: true },
      OR: [{ state: 'ACTIVE' }, { state: 'WAITING', nextEvalAt: { lte: now } }],
    },
    include: { journey: true },
  });
  const results: Array<{ runId: string; state: string; staged: string[] }> = [];
  for (const row of due) {
    const subscriber = await db.subscriber.findFirst({
      where: { id: row.subscriberId, candidateId },
      include: { activities: { where: { type: { in: ['OPENED', 'CLICKED'] } }, select: { type: true, occurredAt: true } } },
    });
    const silo = await db.candidateSilo.findUnique({ where: { id: candidateId } });
    if (!subscriber || !silo) continue;
    const current: RunState = {
      stepIndex: row.stepIndex,
      state: row.state,
      nextEvalAt: row.nextEvalAt,
      log: (Array.isArray(row.log) ? row.log : []) as unknown as RunLogEntry[],
    };
    const { run, effects } = advance(parseJourneyDefinition(row.journey.definition), current, {
      vipScore: subscriber.vipScore,
      phone: subscriber.phone,
      engagedSince: engagedSinceFor(subscriber.activities),
    }, now);
    await db.journeyRun.update({
      where: { id: row.id },
      data: { state: run.state, stepIndex: run.stepIndex, nextEvalAt: run.nextEvalAt, log: run.log as unknown as Prisma.InputJsonValue },
    });
    const staged = await applyEffects(db, silo, subscriber, effects, composer, row.id);
    results.push({ runId: row.id, state: run.state, staged });
  }
  return results;
}
