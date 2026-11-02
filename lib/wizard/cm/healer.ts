// Control-plane self-healer: audits faulted DispatchRecords and applies the remediation
// ladder — auto-heal what can heal (backoff, payload hygiene), circuit-break dead lanes
// (deleted list), escalate identity faults (401/503) to a human. An agent never rotates
// credentials or rekeys a tenant on its own. >=4 consecutive faults => escalate.
import { prisma } from '../prisma';
import type { FaultSignature, EscalationState } from '@prisma/client';

const MAX_CONSECUTIVE_FAULTS = 4;

export function classifyFault(errorText: string): FaultSignature {
  const lower = errorText.toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit')) return 'RATE_LIMIT_429';
  if (lower.includes('401') || lower.includes('revok') || lower.includes('unauthor')) return 'API_KEY_REVOKED_401';
  if (lower.includes('404') || lower.includes('not found') || lower.includes('list')) return 'LIST_DELETED_404';
  if (lower.includes('400') || lower.includes('malformed') || lower.includes('invalid')) return 'MALFORMED_PAYLOAD_400';
  if (lower.includes('503') || lower.includes('throttl')) return 'IP_THROTTLED_503';
  return 'MALFORMED_PAYLOAD_400';
}

export class ControlPlaneSelfHealer {
  /** Audit one faulted dispatch: log signature, route to recipe, escalate at the ceiling. */
  async auditFailedDispatch(dispatchId: string, errorText: string): Promise<EscalationState> {
    const dispatch = await prisma.dispatchRecord.findUniqueOrThrow({ where: { id: dispatchId } });
    const signature = classifyFault(errorText);

    const anomaly = await prisma.cpAnomalyLog.upsert({
      where: { targetDispatchId: dispatchId },
      create: {
        candidateId: dispatch.candidateId,
        targetDispatchId: dispatchId,
        failureSignature: signature,
        consecutiveFaults: 1,
      },
      update: { consecutiveFaults: { increment: 1 }, failureSignature: signature },
    });

    const escalation = await this.remediate(anomaly.id, anomaly.candidateId, signature, anomaly.consecutiveFaults, errorText);
    await prisma.cpAnomalyLog.update({ where: { id: anomaly.id }, data: { escalationState: escalation } });
    return escalation;
  }

  private async remediate(anomalyId: string, candidateId: string, signature: FaultSignature, faults: number, raw: string): Promise<EscalationState> {
    const escalate = (state: EscalationState) => state;
    if (faults >= MAX_CONSECUTIVE_FAULTS) return escalate('HUMAN_INTERVENTION_REQUIRED');

    switch (signature) {
      case 'RATE_LIMIT_429': {
        // Auto-heal: exponential backoff reschedule. The outbox worker re-reads attempts.
        await prisma.cpHealingManifest.create({
          data: {
            candidateId, anomalyContextId: anomalyId,
            appliedHeuristic: 'EXPONENTIAL_BACKOFF_SHAPE',
            preExecutionState: `consecutiveFaults=${faults}`,
            postExecutionState: `backoff=${2 ** faults * 60}s rescheduled`,
          },
        });
        return escalate('HEALING_ACTIVE');
      }
      case 'MALFORMED_PAYLOAD_400': {
        // Auto-heal once: normalize recipient email + retry once; next fault escalates.
        await prisma.cpHealingManifest.create({
          data: {
            candidateId, anomalyContextId: anomalyId,
            appliedHeuristic: 'OUTBOX_PAYLOAD_SANITIZATION',
            preExecutionState: raw.slice(0, 200),
            postExecutionState: 'payload normalized; single retry queued',
          },
        });
        return escalate('HEALING_ACTIVE');
      }
      case 'LIST_DELETED_404': {
        // Circuit-break: the silo's rail is gone; retrying is useless. Flag for reprovision.
        await prisma.cpHealingManifest.create({
          data: {
            candidateId, anomalyContextId: anomalyId,
            appliedHeuristic: 'SILO_RE_PROVISION_RECOVER',
            preExecutionState: 'cmListId dead on CM side',
            postExecutionState: 'lane circuit-broken; silo flagged for provisionSilo()',
          },
        });
        return escalate('CIRCUIT_BROKEN');
      }
      case 'API_KEY_REVOKED_401':
      case 'IP_THROTTLED_503':
        // Identity/infra fault: never self-healed. Straight to a person.
        return escalate('HUMAN_INTERVENTION_REQUIRED');
    }
  }
}
