// The courier (Weapon 6 + 12 + 13). Order of operations for one dispatch request:
//   1. load the campaign inside its silo
//   2. consult external gates (E20 GO, E10 clearance, platform suppression, kill switch, Ed's order)
//   3. evaluateCampaignGates → BLOCKED | DRY_RUN | LIVE
//   4. per recipient: exit gate (RNC_RegID + candidate name + committee id) → HELD
//                     dual-scope suppression for this message class → SUPPRESSED
//                     render with signed unsubscribe link + physical address → DRY_RUN log | LIVE send
//   5. append one DispatchRecord per recipient (idempotent per variant × recipient)
// A LIVE send freezes the variant first, so the bytes that left can never be edited.

import { isGoverned } from '../channels/registry';
import { checkSuppression, type PlatformSuppressionSource } from '../compliance/suppression';
import { evaluateSubscriber, percentileOf, sliceForPercentile, type FeederVerdict } from '../feeder/nova';
import { createUnsubscribeToken, listUnsubscribeHeaders, oneClickEndpoint, unsubscribeUrl } from '../compliance/unsubscribe';
import { exitGateMissing } from '../identity';
import { compileEmail, CompileError } from '../templates/compiler';
import { sha256 } from '../variants';
import { evaluateCampaignGates, type CampaignGateReport } from './gates';
import type { E10ClearanceProvider, E20GoProvider } from './providers';
import type { DispatchContext, DispatchRecipient, DispatchStore } from './store';
import type { EmailTransport } from './transport';

export interface CourierDeps {
  store: DispatchStore;
  e20: E20GoProvider;
  e10: E10ClearanceProvider;
  platformSuppression: PlatformSuppressionSource;
  transport: EmailTransport | null;
  unsubscribeSecret: string;
  baseUrl: string;
  requestedMode: 'DRY_RUN' | 'LIVE';
  edLiveOrder: string | undefined;
  now: () => Date;
  log: (line: string) => void;
}

export interface RecipientOutcome {
  subscriberId: string;
  email: string;
  mode: 'HELD' | 'SUPPRESSED' | 'DRY_RUN' | 'LIVE';
  reason: string;
  idempotencyKey: string;
  providerMessageId?: string;
  duplicate?: boolean;
}

export interface DispatchSummary {
  campaignId: string;
  candidateId: string;
  variantId: string | null;
  contentHash: string | null;
  report: CampaignGateReport;
  outcomes: RecipientOutcome[];
  counts: Record<RecipientOutcome['mode'], number>;
}

export class DispatchNotFoundError extends Error {
  constructor() {
    super('Campaign not found in this silo');
    this.name = 'DispatchNotFoundError';
  }
}

function senderAddress(context: DispatchContext): string {
  const { silo } = context;
  const name = (silo.candidateName ? `${silo.candidateName} via ${silo.fromName}` : silo.fromName).replace(/[<>"]/g, '');
  return `"${name}" <${silo.fromEmail}>`;
}

function log(deps: CourierDeps, mode: string, payload: Record<string, unknown>): void {
  deps.log(`[wizard-agency][${mode}] ${JSON.stringify(payload)}`);
}

export async function dispatchCampaign(
  deps: CourierDeps,
  input: { candidateId: string; campaignId: string; requestedById: string },
): Promise<DispatchSummary> {
  const context = await deps.store.loadContext(input.candidateId, input.campaignId);
  if (!context) throw new DispatchNotFoundError();
  const { silo, campaign, variant } = context;

  const gateRequest = variant
    ? { candidateId: silo.id, bgopCandidateId: silo.bgopCandidateId, campaignId: campaign.id, variantId: variant.id, contentHash: variant.contentHash, channel: campaign.channel }
    : null;
  const denied = { granted: false, detail: 'no variant to evaluate' };
  const [e20, e10, platformAvailable, killSwitchEngaged] = await Promise.all([
    gateRequest ? deps.e20.check(gateRequest) : Promise.resolve(denied),
    gateRequest ? deps.e10.check(gateRequest) : Promise.resolve(denied),
    deps.platformSuppression.available(),
    deps.store.killSwitchEngaged(silo.agencyId),
  ]);

  const report = evaluateCampaignGates({
    campaign,
    variant: variant ? { id: variant.id, contentHash: variant.contentHash } : null,
    authorizations: context.authorizations,
    channelGoverned: isGoverned(campaign.channel),
    agentAction: campaign.originAgentKey ? { agentKey: campaign.originAgentKey, action: 'dispatch' } : undefined,
    delegations: context.delegations,
    now: deps.now(),
    e20,
    e10,
    platformSuppressionAvailable: platformAvailable,
    killSwitchEngaged,
    edLiveOrder: deps.edLiveOrder,
    requestedMode: deps.requestedMode,
  });

  const summary: DispatchSummary = {
    campaignId: campaign.id,
    candidateId: silo.id,
    variantId: variant?.id ?? null,
    contentHash: variant?.contentHash ?? null,
    report,
    outcomes: [],
    counts: { HELD: 0, SUPPRESSED: 0, DRY_RUN: 0, LIVE: 0 },
  };

  log(deps, 'GATES', {
    campaignId: campaign.id,
    silo: silo.slug,
    requestedBy: input.requestedById,
    effectiveMode: report.effectiveMode,
    failed: report.gates.filter((g) => !g.pass).map((g) => `${g.gate}: ${g.detail}`),
  });
  if (report.effectiveMode === 'BLOCKED' || !variant) return summary;

  const live = report.effectiveMode === 'LIVE';
  if (live && !deps.transport) {
    throw new Error('LIVE dispatch passed every gate but no transport is bound; refusing (no silent success)');
  }

  const recipients: DispatchRecipient[] = await deps.store.recipients(context);
  const emails = recipients.map((r) => r.email);
  const suppressionRows = [
    ...(await deps.store.suppressionRows(silo.id, silo.agencyId, emails)),
    ...(platformAvailable ? await deps.platformSuppression.rowsFor(emails) : []),
  ];

  // AI funnel feeder: score every recipient from their silo's activity before any send.
  // Cohort = this dispatch's recipients, so percentile slices are per-campaign.
  const activityMap = await deps.store.subscriberActivity(silo.id, recipients.map((r) => r.subscriberId));
  const verdicts = new Map<string, FeederVerdict>();
  const now = deps.now();
  for (const recipient of recipients) {
    verdicts.set(recipient.subscriberId, evaluateSubscriber(activityMap.get(recipient.subscriberId) ?? [], now));
  }
  const cohortScores = [...verdicts.values()].map((v) => v.scores.HighValueConversionPropensity);
  const slicesFor = (verdict: FeederVerdict) => ({
    HighValueConversionPropensity: sliceForPercentile(percentileOf(verdict.scores.HighValueConversionPropensity, cohortScores)),
  });

  if (live) await deps.store.freezeVariant(variant.id, `dispatched LIVE ${deps.now().toISOString()}`, deps.now());

  for (const recipient of recipients) {
    const idempotencyKey = sha256(`${campaign.id}:${variant.id}:${recipient.subscriberId}`);
    const base = { subscriberId: recipient.subscriberId, email: recipient.email, idempotencyKey };
    let outcome: RecipientOutcome;
    let renderedHash: string | null = null;

    const missing = exitGateMissing({ rncRegId: recipient.rncRegId, candidateName: silo.candidateName, committeeId: silo.committeeId });
    const verdict = checkSuppression(recipient.email, campaign.messageClass, suppressionRows);

    if (missing.length) {
      outcome = { ...base, mode: 'HELD', reason: `exit gate: missing ${missing.join(', ')}` };
    } else if (verdict.suppressed) {
      outcome = { ...base, mode: 'SUPPRESSED', reason: verdict.blocking.map((b) => `${b.scope}:${b.level}:${b.reason}`).join('; ') };
    } else {
      const token = await createUnsubscribeToken(silo.id, recipient.subscriberId, deps.unsubscribeSecret);
      let compiled;
      try {
        compiled = compileEmail(variant.blocks, {
          subject: variant.subject,
          preheader: variant.preheader,
          merge: {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            officeSought: silo.officeSought,
            venueInterest: recipient.venueInterest,
            candidateName: silo.candidateName,
          },
          compliance: {
            senderName: silo.candidateName ?? silo.fromName,
            physicalAddress: silo.physicalAddress,
            paidForBy: silo.paidForBy,
            unsubscribeUrl: unsubscribeUrl(deps.baseUrl, silo.slug, token),
          },
        });
      } catch (error) {
        const reason = error instanceof CompileError ? error.issues.join('; ') : String(error);
        outcome = { ...base, mode: 'HELD', reason: `render failed: ${reason}` };
        summary.outcomes.push(outcome);
        summary.counts.HELD++;
        await deps.store.recordDispatch({ candidateId: silo.id, campaignId: campaign.id, variantId: variant.id, subscriberId: recipient.subscriberId, recipientEmail: recipient.email, mode: 'HELD', gateReport: { report, recipient: outcome }, idempotencyKey, renderedHash: null, providerMessageId: null });
        continue;
      }
      renderedHash = sha256(compiled.html);
      const headers = listUnsubscribeHeaders(oneClickEndpoint(deps.baseUrl, silo.slug, token));

      if (live && deps.transport) {
        const receipt = await deps.transport.send({
          from: senderAddress(context),
          to: recipient.email,
          ...(silo.replyToEmail ? { replyTo: silo.replyToEmail } : {}),
          subject: compiled.subject,
          html: compiled.html,
          text: compiled.text,
          headers,
          idempotencyKey,
        });
        outcome = { ...base, mode: 'LIVE', reason: 'provider accepted', providerMessageId: receipt.providerMessageId };
      } else {
        outcome = { ...base, mode: 'DRY_RUN', reason: `not sent: ${report.failedLiveGates.join(', ') || 'dry-run'}` };
        log(deps, 'DRY_RUN', {
          to: recipient.email,
          from: senderAddress(context),
          subject: compiled.subject,
          headers,
          renderedHash,
          htmlBytes: Buffer.byteLength(compiled.html, 'utf8'),
          textBytes: Buffer.byteLength(compiled.text, 'utf8'),
          blockedBy: report.failedLiveGates,
        });
      }
    }

    const feederVerdict = verdicts.get(recipient.subscriberId);
    if (feederVerdict) await deps.store.recordFeederVerdict(silo.id, recipient.subscriberId, feederVerdict, slicesFor(feederVerdict), campaign.id);

    const { created } = await deps.store.recordDispatch({
      candidateId: silo.id,
      campaignId: campaign.id,
      variantId: variant.id,
      subscriberId: recipient.subscriberId,
      recipientEmail: recipient.email,
      mode: outcome.mode,
      gateReport: { report, recipient: outcome },
      idempotencyKey,
      renderedHash,
      providerMessageId: outcome.providerMessageId ?? null,
    });
    if (!created) outcome.duplicate = true;
    summary.outcomes.push(outcome);
    summary.counts[outcome.mode]++;
  }

  log(deps, 'SUMMARY', { campaignId: campaign.id, effectiveMode: report.effectiveMode, counts: summary.counts });
  return summary;
}
