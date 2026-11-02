// LP revenue optimizer: expected revenue = P(buy) × OfferSegmentValue × step coefficient.
// v1 uses greedy sort + per-subscriber touch cap inside one silo — honest MVP; the
// signature leaves room for a real constraint solver (HiGHS) when budget/inventory
// constraints land. Every scored candidate writes an OptimizationAllocation row.
import { prisma } from '../prisma';

export interface LpCandidate {
  subscriberId: string;
  email: string;
  offerId: string;
  stepId: string;
  microsegmentKey: string;
  propensityOpen: number;
  propensityClick: number;
  propensityBuy: number;
}

export interface AllocationPlan {
  subscriberId: string;
  offerId: string;
  stepId: string;
  expectedRevenue: number;
}

// Pure core: score = P(buy) × segment value × step coefficient, greedy desc, per-subscriber
// cap. DB-free so tests exercise the exact math the write-back stores.
export function scoreAndCap(
  candidates: LpCandidate[],
  valueOf: (offerId: string, microsegmentKey: string) => number,
  coefOf: (stepId: string) => number,
  touchCap: number,
): AllocationPlan[] {
  const scored = candidates.map((c) => ({
    ...c,
    expectedRevenue: c.propensityBuy * valueOf(c.offerId, c.microsegmentKey) * coefOf(c.stepId),
  }));
  scored.sort((a, b) => b.expectedRevenue - a.expectedRevenue);
  const touches = new Map<string, number>();
  const plan: AllocationPlan[] = [];
  for (const c of scored) {
    const n = touches.get(c.subscriberId) ?? 0;
    if (n >= touchCap) continue;
    touches.set(c.subscriberId, n + 1);
    plan.push({ subscriberId: c.subscriberId, offerId: c.offerId, stepId: c.stepId, expectedRevenue: c.expectedRevenue });
  }
  return plan;
}

export async function optimize(
  candidateId: string,
  candidates: LpCandidate[],
  touchCap = 1,
): Promise<AllocationPlan[]> {
  const values = await prisma.offerSegmentValue.findMany({
    where: { offer: { candidateId } },
    include: { offer: true },
  });
  const valueMap = new Map(values.map((v) => [`${v.offerId}_${v.microsegmentKey}`, v.adjustedValue]));
  const baseMap = new Map(values.map((v) => [v.offerId, v.offer.baseValue]));

  const steps = await prisma.automatedJourneyStep.findMany({ where: { journey: { candidateId } } });
  const coefMap = new Map(steps.map((s) => [s.id, s.revenueDiscountCoefficient]));

  const plan = scoreAndCap(
    candidates,
    (offerId, microsegmentKey) => valueMap.get(`${offerId}_${microsegmentKey}`) ?? baseMap.get(offerId) ?? 0,
    (stepId) => coefMap.get(stepId) ?? 1.0,
    touchCap,
  );

  const candidateMap = new Map(candidates.map((c) => [`${c.subscriberId}_${c.offerId}_${c.stepId}`, c]));
  const rows = [];
  for (const alloc of plan) {
    const c = candidateMap.get(`${alloc.subscriberId}_${alloc.offerId}_${alloc.stepId}`)!;
    rows.push({
      candidateId,
      subscriberId: c.subscriberId,
      offerId: c.offerId,
      stepId: c.stepId,
      propensityOpen: c.propensityOpen,
      propensityClick: c.propensityClick,
      propensityBuy: c.propensityBuy,
      expectedRevenue: c.expectedRevenue,
      arbitrationWin: true,
    });
  }
  if (rows.length) await prisma.optimizationAllocation.createMany({ data: rows });
  return plan;
}
