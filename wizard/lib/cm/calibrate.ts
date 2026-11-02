// Learning-loop calibration: rolling sum of varianceRevenue per journey step adjusts
// revenueDiscountCoefficient (chronic over-predictors get starved; reliable steps recover
// toward 1.0). Threshold is a PERCENTAGE of predicted revenue, not absolute dollars —
// a $5k silo and a $500k silo can't share one. Every shift writes a StepCoefficientLog.
import { prisma } from '../prisma';

export interface CalibrationResult {
  stepId: string;
  name: string;
  rollingVariance: number;
  oldCoef: number;
  newCoef: number;
  action: 'PENALIZED' | 'RECOVERED' | 'STABILIZED';
}

export async function calibrateStepCoefficients(
  candidateId: string,
  lookbackDays = 7,
  discountIntensity = 0.15,
  penaltyRatio = 0.25, // penalize when cumulative variance < -25% of predicted
): Promise<CalibrationResult[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const steps = await prisma.automatedJourneyStep.findMany({
    where: { journey: { candidateId } },
    include: {
      pipelines: {
        where: { sentAt: { gte: since } },
        include: { varianceSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
      },
    },
  });

  const results: CalibrationResult[] = [];
  for (const step of steps) {
    const snaps = step.pipelines.map((p) => p.varianceSnapshots[0]).filter(Boolean);
    if (!snaps.length) continue;

    const rollingVariance = snaps.reduce((s, x) => s + x.varianceRevenue, 0);
    const predictedTotal = snaps.reduce((s, x) => s + x.predictedRevenue, 0);
    const oldCoef = step.revenueDiscountCoefficient;
    let newCoef = oldCoef;
    let action: CalibrationResult['action'] = 'STABILIZED';

    if (predictedTotal > 0 && rollingVariance < -penaltyRatio * predictedTotal) {
      newCoef = Math.max(0.1, oldCoef - discountIntensity);
      action = 'PENALIZED';
    } else if (rollingVariance >= 0 && oldCoef < 1.0) {
      newCoef = Math.min(1.0, oldCoef + 0.05);
      action = 'RECOVERED';
    }

    if (newCoef !== oldCoef) {
      await prisma.$transaction([
        prisma.automatedJourneyStep.update({
          where: { id: step.id },
          data: { revenueDiscountCoefficient: newCoef, coefficientLastCalibratedAt: new Date() },
        }),
        prisma.stepCoefficientLog.create({
          data: { stepId: step.id, oldCoef, newCoef, rollingVariance },
        }),
      ]);
    }
    results.push({ stepId: step.id, name: step.name, rollingVariance, oldCoef, newCoef, action });
  }
  return results;
}
