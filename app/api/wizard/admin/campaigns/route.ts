// Campaign queue + lifecycle for the active silo. Every read and write is scoped by candidateId.
// PATCH actions: COMPOSE · SUBMIT · PUBLISH · DISMISS · AUTHORIZE · DISPATCH.

import type { Channel, MessageClass } from '@generated/wizard-prisma';
import { edLiveOrder, publicBaseUrl, requestedDispatchMode, requireSecret } from '@/lib/wizard/config';
import { json, readJson, withAdmin } from '@/lib/wizard/api';
import { unboundPlatformSuppression } from '@/lib/wizard/compliance/suppression';
import { dispatchCampaign } from '@/lib/wizard/dispatch/courier';
import { unboundE10Clearance, unboundE20Go } from '@/lib/wizard/dispatch/providers';
import { PrismaDispatchStore } from '@/lib/wizard/dispatch/store-prisma';
import { transportFromEnv } from '@/lib/wizard/dispatch/transport';
import { prisma } from '@/lib/wizard/prisma';
import { can } from '@/lib/wizard/rbac';
import { requireSilo, scoped } from '@/lib/wizard/scope';
import { authorizeVariant, dismiss, LifecycleError, publish, saveComposition, submitForReview } from '@/lib/wizard/services/campaigns';

const CHANNELS: readonly Channel[] = ['EMAIL', 'SMS', 'RVM', 'DIRECT_MAIL', 'SOCIAL', 'PHONE_BANK', 'CONVERSATION'];
const CLASSES: readonly MessageClass[] = ['BULK', 'EVENT_INVITATION', 'PERSONAL', 'TRANSACTIONAL'];
const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'DISMISSED'] as const;

export async function GET(request: Request) {
  return withAdmin(request, 'campaign.read', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const status = new URL(request.url).searchParams.get('status');
    const where = scoped(silo, STATUSES.includes(status as (typeof STATUSES)[number]) ? { status: status as (typeof STATUSES)[number] } : {});
    const campaigns = await prisma.aiContentPipeline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { variants: { orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, subject: true, contentHash: true, frozenAt: true } } },
    });
    return json({ silo: silo.silo.slug, count: campaigns.length, campaigns });
  });
}

export async function POST(request: Request) {
  return withAdmin(request, 'campaign.draft', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const body = await readJson(request);
    const channel = (body.channel ?? 'EMAIL') as Channel;
    const messageClass = (body.messageClass ?? 'BULK') as MessageClass;
    if (!CHANNELS.includes(channel)) throw new LifecycleError(400, 'Unknown channel');
    if (!CLASSES.includes(messageClass)) throw new LifecycleError(400, 'Unknown message class');
    const ref = (key: string) => (typeof body[key] === 'string' && body[key] ? (body[key] as string) : null);
    const audienceListId = ref('audienceListId');
    const audienceSegmentId = ref('audienceSegmentId');
    const recipientSubscriberId = ref('recipientSubscriberId');
    const templateId = ref('templateId');
    // Every reference must live in this silo — never trust ids from the client.
    const checks = await Promise.all([
      audienceListId ? prisma.subscriberList.count({ where: scoped(silo, { id: audienceListId }) }) : 1,
      audienceSegmentId ? prisma.dynamicSegment.count({ where: scoped(silo, { id: audienceSegmentId }) }) : 1,
      recipientSubscriberId ? prisma.subscriber.count({ where: scoped(silo, { id: recipientSubscriberId }) }) : 1,
      templateId ? prisma.emailTemplate.count({ where: scoped(silo, { id: templateId }) }) : 1,
    ]);
    if (checks.some((n) => n !== 1)) throw new LifecycleError(404, 'Audience or template not found in this silo');
    const campaign = await prisma.aiContentPipeline.create({
      data: {
        candidateId: silo.silo.id,
        channel,
        messageClass,
        title: typeof body.title === 'string' ? body.title.slice(0, 200) : null,
        suggestedDraft: typeof body.suggestedDraft === 'string' ? body.suggestedDraft : '',
        audienceListId, audienceSegmentId, recipientSubscriberId, templateId,
        status: 'DRAFT',
        createdById: actor.userId,
      },
    });
    return json({ campaign }, 201);
  });
}

export async function PATCH(request: Request) {
  return withAdmin(request, 'campaign.read', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const body = await readJson(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action.toUpperCase() : '';
    if (!id) throw new LifecycleError(400, 'id is required');
    const need = (permission: Parameters<typeof can>[1]) => {
      if (!can(actor.role, permission)) throw new LifecycleError(403, `Role ${actor.role} lacks ${permission}`);
    };
    const candidateId = silo.silo.id;

    switch (action) {
      case 'COMPOSE': {
        need('campaign.draft');
        const result = await saveComposition(prisma, candidateId, id, {
          subject: typeof body.subject === 'string' ? body.subject : '',
          preheader: typeof body.preheader === 'string' ? body.preheader : null,
          blocks: body.blocks,
        }, actor);
        return json({ variant: { id: result.variant.id, version: result.variant.version, contentHash: result.variant.contentHash, frozenAt: result.variant.frozenAt }, plan: result.plan, warnings: result.warnings });
      }
      case 'SUBMIT':
        need('campaign.submit');
        return json({ campaign: await submitForReview(prisma, candidateId, id, actor) });
      case 'PUBLISH':
        need('campaign.publish');
        return json({ campaign: await publish(prisma, candidateId, id, actor) });
      case 'DISMISS':
        need('campaign.draft');
        return json({ campaign: await dismiss(prisma, candidateId, id) });
      case 'AUTHORIZE': {
        const authorization = await authorizeVariant(prisma, candidateId, id, {
          phrase: typeof body.phrase === 'string' ? body.phrase : '',
          contentHash: typeof body.contentHash === 'string' ? body.contentHash : '',
          device: request.headers.get('user-agent'),
        }, actor);
        return json({ authorization: { id: authorization.id, contentHash: authorization.contentHash, createdAt: authorization.createdAt } }, 201);
      }
      case 'DISPATCH': {
        need('campaign.dispatch');
        const summary = await dispatchCampaign({
          store: new PrismaDispatchStore(prisma),
          e20: unboundE20Go,
          e10: unboundE10Clearance,
          platformSuppression: unboundPlatformSuppression,
          transport: transportFromEnv(),
          unsubscribeSecret: requireSecret('WIZARD_UNSUBSCRIBE_SECRET'),
          baseUrl: publicBaseUrl(),
          requestedMode: requestedDispatchMode(),
          edLiveOrder: edLiveOrder(),
          now: () => new Date(),
          log: (line) => console.info(line),
        }, { candidateId, campaignId: id, requestedById: actor.userId });
        return json(summary, summary.report.effectiveMode === 'BLOCKED' ? 409 : 200);
      }
      default:
        throw new LifecycleError(400, 'action must be COMPOSE, SUBMIT, PUBLISH, DISMISS, AUTHORIZE or DISPATCH');
    }
  });
}
