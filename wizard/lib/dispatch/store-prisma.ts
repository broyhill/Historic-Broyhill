// Prisma-backed DispatchStore. Every query carries candidateId; nothing reads across silos except
// the agency-wide GlobalSuppression lookup, which is the point of that table.

import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';
import type { SuppressionRow } from '../compliance/suppression';
import { PRODUCED_GOALS, type FeederActivity, type FeederVerdict, type PropensityGoal } from '../feeder/nova';
import { normalizeEmail } from '../identity';
import { parseSegmentRules, segmentWhere } from '../segments';
import { parseBlocks } from '../templates/blocks';
import type { DispatchContext, DispatchRecipient, DispatchStore, NewDispatchRecord } from './store';

export class PrismaDispatchStore implements DispatchStore {
  constructor(private readonly db: PrismaClient) {}

  async loadContext(candidateId: string, campaignId: string): Promise<DispatchContext | null> {
    const campaign = await this.db.aiContentPipeline.findFirst({
      where: { id: campaignId, candidateId },
      include: {
        candidate: { include: { agentDelegations: true } },
        variants: { orderBy: { version: 'desc' }, take: 1, include: { authorizations: true } },
      },
    });
    if (!campaign || !campaign.candidate) return null;
    let reviewedByRole: UserRole | null = null;
    if (campaign.reviewedById) {
      const reviewer = await this.db.candidateUser.findUnique({ where: { id: campaign.reviewedById }, select: { role: true } });
      reviewedByRole = reviewer?.role ?? null;
    }
    const authorizerIds = [...new Set(campaign.variants.flatMap((v) => v.authorizations.map((a) => a.authorizedById)))];
    const principals = new Set(
      (await this.db.candidateUser.findMany({ where: { id: { in: authorizerIds }, candidateId, isCandidatePrincipal: true }, select: { id: true } }))
        .map((u) => u.id),
    );
    const latest = campaign.variants[0];
    const silo = campaign.candidate;
    return {
      silo: {
        id: silo.id, slug: silo.slug, agencyId: silo.agencyId, bgopCandidateId: silo.bgopCandidateId,
        candidateName: silo.candidateName, committeeId: silo.committeeId, officeSought: silo.officeSought,
        fromName: silo.fromName, fromEmail: silo.fromEmail, replyToEmail: silo.replyToEmail,
        physicalAddress: silo.physicalAddress, paidForBy: silo.paidForBy,
      },
      campaign: {
        id: campaign.id, candidateId, status: campaign.status, channel: campaign.channel,
        messageClass: campaign.messageClass, reviewedByRole,
        audienceListId: campaign.audienceListId, audienceSegmentId: campaign.audienceSegmentId,
        recipientSubscriberId: campaign.recipientSubscriberId,
        originAgentKey: campaign.originAgentKey,
      },
      variant: latest
        ? { id: latest.id, version: latest.version, subject: latest.subject, preheader: latest.preheader, blocks: parseBlocks(latest.blocks), contentHash: latest.contentHash, frozenAt: latest.frozenAt }
        : null,
      authorizations: (latest?.authorizations ?? []).map((a) => ({
        id: a.id, contentHash: a.contentHash, phrase: a.phrase, authorizedByPrincipal: principals.has(a.authorizedById),
      })),
      delegations: (silo.agentDelegations ?? []).map((d) => ({
        id: d.id, agentKey: d.agentKey,
        privileges: d.privileges.split(',').map((p) => p.trim()).filter(Boolean),
        expiresAt: d.expiresAt, revokedAt: d.revokedAt,
      })),
    };
  }

  async recipients(context: DispatchContext): Promise<DispatchRecipient[]> {
    const { campaign } = context;
    const candidateId = campaign.candidateId;
    let where: Prisma.SubscriberWhereInput | null = null;
    if (campaign.recipientSubscriberId) where = { id: campaign.recipientSubscriberId, candidateId };
    else if (campaign.audienceListId) where = { candidateId, lists: { some: { listId: campaign.audienceListId } } };
    else if (campaign.audienceSegmentId) {
      const segment = await this.db.dynamicSegment.findFirst({ where: { id: campaign.audienceSegmentId, candidateId } });
      if (segment) where = segmentWhere(candidateId, parseSegmentRules(segment.rules));
    }
    if (!where) return [];
    // No hidden LIMIT (Completeness Law): the full audience is expanded.
    const rows = await this.db.subscriber.findMany({ where, orderBy: { createdAt: 'asc' } });
    return rows.map((s) => ({
      subscriberId: s.id, email: s.email, firstName: s.firstName, lastName: s.lastName,
      venueInterest: s.venueInterest, rncRegId: s.rncRegId,
    }));
  }

  async suppressionRows(candidateId: string, agencyId: string, emails: string[]): Promise<SuppressionRow[]> {
    const normalized = [...new Set(emails.map(normalizeEmail).filter((e): e is string => Boolean(e)))];
    if (!normalized.length) return [];
    const [silo, global] = await Promise.all([
      this.db.siloSuppression.findMany({ where: { candidateId, email: { in: normalized } } }),
      this.db.globalSuppression.findMany({ where: { agencyId, email: { in: normalized } } }),
    ]);
    return [
      ...silo.map((s) => ({ email: s.email, level: s.level, reason: s.reason, scope: 'SILO' as const })),
      ...global.map((s) => ({ email: s.email, level: s.level, reason: s.reason, scope: 'GLOBAL' as const })),
    ];
  }

  async killSwitchEngaged(agencyId: string): Promise<boolean> {
    const control = await this.db.agencyControl.findUnique({ where: { agencyId } });
    return control?.killSwitchEngaged ?? true; // no row = engaged (fail closed)
  }

  async freezeVariant(variantId: string, reason: string, at: Date): Promise<void> {
    await this.db.messageVariant.updateMany({ where: { id: variantId, frozenAt: null }, data: { frozenAt: at, frozenReason: reason } });
  }

  async recordDispatch(record: NewDispatchRecord): Promise<{ created: boolean }> {
    try {
      await this.db.dispatchRecord.create({
        data: { ...record, gateReport: record.gateReport as Prisma.InputJsonValue },
      });
      return { created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { created: false };
      throw error;
    }
  }

  async subscriberActivity(candidateId: string, subscriberIds: string[]): Promise<Map<string, FeederActivity[]>> {
    const map = new Map<string, FeederActivity[]>();
    if (!subscriberIds.length) return map;
    const rows = await this.db.subscriberActivity.findMany({
      where: { candidateId, subscriberId: { in: subscriberIds } },
      orderBy: { occurredAt: 'asc' },
      select: { subscriberId: true, type: true, occurredAt: true },
    });
    for (const row of rows) {
      if (!row.subscriberId) continue;
      const list = map.get(row.subscriberId) ?? [];
      list.push({ type: row.type, occurredAt: row.occurredAt });
      map.set(row.subscriberId, list);
    }
    return map;
  }

  async recordFeederVerdict(
    candidateId: string,
    subscriberId: string,
    verdict: FeederVerdict,
    slices: Partial<Record<PropensityGoal, string>>,
    journeyId?: string,
  ): Promise<void> {
    const now = new Date();
    const subscriber = await this.db.subscriber.findFirst({ where: { id: subscriberId, candidateId }, select: { affinityLabel: true } });
    if (!subscriber) return; // never write across the silo boundary

    for (const goal of PRODUCED_GOALS) {
      await this.db.subscriberPropensity.upsert({
        where: { candidateId_subscriberId_goal: { candidateId, subscriberId, goal } },
        create: { candidateId, subscriberId, goal, score: verdict.scores[goal], slice: slices[goal] ?? null },
        update: { score: verdict.scores[goal], slice: slices[goal] ?? null, scoredAt: now },
      });
    }

    await this.db.subscriber.update({
      where: { id: subscriberId },
      data: {
        affinityLabel: verdict.affinity,
        affinityScoredAt: now,
        sendTimeOptimalHour: verdict.sendTimeOptimalHour,
        frequencyCapPerWeek: verdict.frequencyCapPerWeek,
      },
    });

    // A proposal is filed when the label moved or the verdict demands action — never on
    // every dispatch, and never with a duplicate pending proposal of the same action.
    const labelMoved = subscriber.affinityLabel !== verdict.affinity;
    const demandsAction = verdict.action !== 'NURTURE';
    if (!labelMoved && !demandsAction) return;
    const pending = await this.db.funnelProposal.findFirst({
      where: { candidateId, subscriberId, action: verdict.action, status: 'PENDING_APPROVAL' },
      select: { id: true },
    });
    if (pending) return;
    await this.db.funnelProposal.create({
      data: { candidateId, subscriberId, action: verdict.action, reason: verdict.reason, journeyId: journeyId ?? null },
    });
  }
}
