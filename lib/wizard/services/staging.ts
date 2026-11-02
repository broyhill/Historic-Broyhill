// Stages journey effects into the review queue. Nothing here sends: email drafts become
// PENDING_REVIEW campaigns with a composed variant; SMS drafts become PENDING_REVIEW rows on the
// hooked E31 channel with no dispatch path in this package.

import { Prisma, type CandidateSilo, type PrismaClient, type Subscriber } from '@generated/wizard-prisma';
import type { JourneyEffect } from '../journeys/runner';
import { forgeDraft, type ForgeComposer } from '../orchestration/forge';
import type { EmailBlock } from '../templates/blocks';
import { saveComposition } from './campaigns';

const SYSTEM_ACTOR = { userId: 'system:journey-runner', role: 'CAMPAIGN_DRAFTER' as const, isCandidatePrincipal: false };

export function stagedEmailBlocks(body: string, disclaimer: string): EmailBlock[] {
  return [
    { id: 'header', type: 'header', showPreheader: false, disclaimer, locked: true },
    { id: 'body', type: 'text', content: body },
    { id: 'footer', type: 'footer', text: disclaimer, locked: true },
  ];
}

export async function applyEffects(
  db: PrismaClient,
  silo: CandidateSilo,
  subscriber: Subscriber,
  effects: JourneyEffect[],
  composer: ForgeComposer,
  runId: string | null,
): Promise<string[]> {
  const staged: string[] = [];
  for (const effect of effects) {
    const channel = effect.kind === 'STAGE_EMAIL_DRAFT' ? 'EMAIL' : 'SMS';
    const draft = await forgeDraft(composer, {
      purpose: effect.purpose,
      channel,
      silo: { candidateName: silo.candidateName, officeSought: silo.officeSought, fromName: silo.fromName },
      recipient: { firstName: subscriber.firstName, venueInterest: subscriber.venueInterest },
    });
    const campaign = await db.aiContentPipeline.create({
      data: {
        candidateId: silo.id,
        channel,
        messageClass: 'BULK', // conservative: automated outreach honors bulk suppression
        title: `${effect.purpose === 'WELCOME' ? 'Welcome' : 'Follow-up'} (${channel}) — journey`,
        suggestedDraft: draft.body,
        recipientSubscriberId: subscriber.id,
        status: channel === 'EMAIL' ? 'DRAFT' : 'PENDING_REVIEW',
        sourceJourneyRunId: runId,
        createdById: SYSTEM_ACTOR.userId,
        // AI-written journey draft: dispatch requires a live 'journey-engine' AgentDelegation
        originAgentKey: 'journey-engine',
        metrics: { forgeProvider: draft.provider, guardFlags: draft.flags } as Prisma.InputJsonValue,
      },
    });
    if (channel === 'EMAIL') {
      const disclaimer = silo.paidForBy ?? `Sent on behalf of ${silo.candidateName ?? silo.name}.`;
      await saveComposition(db, silo.id, campaign.id, {
        subject: draft.subject ?? `A note from ${silo.candidateName ?? silo.name}`,
        blocks: stagedEmailBlocks(draft.body, disclaimer),
      }, SYSTEM_ACTOR);
      await db.aiContentPipeline.update({
        where: { id: campaign.id },
        data: { status: 'PENDING_REVIEW', submittedById: SYSTEM_ACTOR.userId, submittedAt: new Date() },
      });
    }
    staged.push(campaign.id);
  }
  return staged;
}
