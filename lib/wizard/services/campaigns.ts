// Campaign lifecycle: DRAFT → PENDING_REVIEW → PUBLISHED (agency approval) → Wizard authorization
// (candidate principal, exact hash) → dispatch (gated). Any content change after approval sends
// the campaign back to PENDING_REVIEW and produces a new hash that no authorization covers.

import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';
import { AUTHORIZATION_PHRASE, publicBaseUrl } from '../config';
import { PUBLISHER_ROLES, canAuthorizeWizard } from '../rbac';
import { parseBlocks, type EmailBlock } from '../templates/blocks';
import { compileEmail } from '../templates/compiler';
import { planRevision, type Composition } from '../variants';

export class LifecycleError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export interface Actor {
  userId: string;
  role: UserRole;
  isCandidatePrincipal: boolean;
}

async function loadCampaign(db: PrismaClient, candidateId: string, campaignId: string) {
  const campaign = await db.aiContentPipeline.findFirst({
    where: { id: campaignId, candidateId },
    include: { candidate: true, variants: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!campaign || !campaign.candidate) throw new LifecycleError(404, 'Campaign not found');
  return campaign;
}

// Saves a composition as a variant: in place while unfrozen, as a child once frozen.
export async function saveComposition(
  db: PrismaClient,
  candidateId: string,
  campaignId: string,
  composition: { subject: string; preheader?: string | null; blocks: unknown },
  actor: Actor,
) {
  const campaign = await loadCampaign(db, candidateId, campaignId);
  if (campaign.status === 'DISMISSED') throw new LifecycleError(409, 'Campaign is dismissed');
  if (campaign.channel !== 'EMAIL') throw new LifecycleError(409, `${campaign.channel} compositions are not built in the agency layer`);
  const blocks: EmailBlock[] = parseBlocks(composition.blocks);
  const next: Composition = { subject: composition.subject.trim(), preheader: composition.preheader?.trim() || null, blocks };
  const silo = campaign.candidate!;
  // Reviewer preview with sample values; per-recipient rendering happens at dispatch.
  const preview = compileEmail(blocks, {
    subject: next.subject,
    preheader: next.preheader,
    merge: { firstName: 'Pat', lastName: 'Sample', officeSought: silo.officeSought, venueInterest: 'The Magnolia Room', candidateName: silo.candidateName },
    compliance: {
      senderName: silo.candidateName ?? silo.fromName,
      physicalAddress: silo.physicalAddress,
      paidForBy: silo.paidForBy,
      unsubscribeUrl: `${publicBaseUrl()}/unsubscribe?silo=${encodeURIComponent(silo.slug)}&token=preview`,
    },
  });
  const latest = campaign.variants[0] ?? null;
  const plan = planRevision(latest, next);
  const data = {
    subject: next.subject,
    preheader: next.preheader,
    blocks: blocks as unknown as Prisma.InputJsonValue,
    html: preview.html,
    text: preview.text,
    contentHash: plan.contentHash,
  };

  return db.$transaction(async (tx) => {
    let variant;
    if (plan.action === 'NO_CHANGE') {
      variant = latest!;
    } else if (plan.action === 'UPDATE_IN_PLACE') {
      const updated = await tx.messageVariant.updateMany({ where: { id: plan.variantId, frozenAt: null }, data });
      if (updated.count !== 1) throw new LifecycleError(409, 'Variant was frozen concurrently; save again to create a child variant');
      variant = await tx.messageVariant.findUniqueOrThrow({ where: { id: plan.variantId } });
    } else {
      variant = await tx.messageVariant.create({
        data: {
          ...data,
          campaignId,
          version: plan.version,
          parentVariantId: plan.action === 'CREATE_CHILD' ? plan.parentVariantId : null,
          createdById: actor.userId,
        },
      });
    }
    // A material change after review goes back to review.
    if (plan.action !== 'NO_CHANGE' && campaign.status === 'PUBLISHED') {
      await tx.aiContentPipeline.update({ where: { id: campaignId }, data: { status: 'PENDING_REVIEW', reviewedById: null, reviewedAt: null, publishedAt: null } });
    }
    return { variant, plan: plan.action, warnings: preview.warnings };
  });
}

export async function submitForReview(db: PrismaClient, candidateId: string, campaignId: string, actor: Actor) {
  const campaign = await loadCampaign(db, candidateId, campaignId);
  if (campaign.status !== 'DRAFT') throw new LifecycleError(409, `Campaign is ${campaign.status}, not DRAFT`);
  if (campaign.channel === 'EMAIL' && !campaign.variants[0]) throw new LifecycleError(409, 'Compose the email before submitting');
  return db.aiContentPipeline.update({
    where: { id: campaignId },
    data: { status: 'PENDING_REVIEW', submittedById: actor.userId, submittedAt: new Date() },
  });
}

// "Authorize Broadcast" in the Campaign Monitor model = agency approval, not candidate consent.
export async function publish(db: PrismaClient, candidateId: string, campaignId: string, actor: Actor) {
  if (!PUBLISHER_ROLES.includes(actor.role)) throw new LifecycleError(403, 'Only AGENCY_ADMIN or CANDIDATE_MANAGER may publish');
  const campaign = await loadCampaign(db, candidateId, campaignId);
  if (campaign.status !== 'PENDING_REVIEW') throw new LifecycleError(409, `Campaign is ${campaign.status}, not PENDING_REVIEW`);
  const now = new Date();
  return db.aiContentPipeline.update({
    where: { id: campaignId },
    data: { status: 'PUBLISHED', reviewedById: actor.userId, reviewedAt: now, publishedAt: now },
  });
}

export async function dismiss(db: PrismaClient, candidateId: string, campaignId: string) {
  await loadCampaign(db, candidateId, campaignId);
  return db.aiContentPipeline.update({ where: { id: campaignId }, data: { status: 'DISMISSED' } });
}

// The Wizard's exact-version authorization (Step 9). The caller sends the hash it displayed; it
// must equal the latest variant's hash, so the candidate authorizes exactly what he read.
export async function authorizeVariant(
  db: PrismaClient,
  candidateId: string,
  campaignId: string,
  input: { phrase: string; contentHash: string; device?: string | null },
  actor: Actor,
) {
  if (!canAuthorizeWizard({ isCandidatePrincipal: actor.isCandidatePrincipal })) {
    throw new LifecycleError(403, 'Only the candidate principal may authorize; agency roles cannot authorize on his behalf');
  }
  if (input.phrase !== AUTHORIZATION_PHRASE) throw new LifecycleError(400, `Type the exact phrase: ${AUTHORIZATION_PHRASE}`);
  const campaign = await loadCampaign(db, candidateId, campaignId);
  if (campaign.status !== 'PUBLISHED') throw new LifecycleError(409, 'Agency approval (PUBLISHED) must precede authorization');
  const variant = campaign.variants[0];
  if (!variant) throw new LifecycleError(409, 'Nothing to authorize');
  if (variant.contentHash !== input.contentHash) throw new LifecycleError(409, 'The content changed since it was displayed; review the new version');
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.messageVariant.updateMany({ where: { id: variant.id, frozenAt: null }, data: { frozenAt: now, frozenReason: 'wizard authorization' } });
    return tx.wizardAuthorization.create({
      data: { candidateId, variantId: variant.id, contentHash: variant.contentHash, phrase: input.phrase, authorizedById: actor.userId, device: input.device ?? null },
    });
  });
}
