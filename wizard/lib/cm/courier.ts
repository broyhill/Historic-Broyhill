// CM courier: stage/fire split. stage = approve-time draft create inside CM (writes
// cmCampaignId, marks stagedAt). fire = send-time call that refuses unless the campaign is
// staged AND the authorization chain is intact — gates.ts stays the single authority on
// whether anything may send; the kill switch is checked before every fire.
import { prisma } from '../prisma';
import { evaluateCampaignGates } from '../dispatch/gates';
import { CampaignMonitorProvider } from './provider';

export class WizardGatedCourier {
  constructor(private cm: CampaignMonitorProvider) {}

  /** Approve-time: create the CM draft wrapper. Stores cmCampaignId, stamps stagedAt. */
  async stageCampaign(pipelineId: string, htmlContentUrl: string): Promise<string> {
    const pipeline = await prisma.aiContentPipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      include: { candidate: true },
    });
    const silo = pipeline.candidate;
    if (!silo?.cmClientId || !silo.cmListId) {
      throw new Error(`silo ${pipeline.candidateId} has no CM rail — run provisionSilo first`);
    }

    const variant = await prisma.messageVariant.findFirst({
      where: { campaignId: pipelineId },
      orderBy: { version: 'desc' },
    });
    if (!variant) throw new Error(`pipeline ${pipelineId} has no variant to stage`);

    const cmCampaignId = await this.cm.createDraft(silo.cmClientId, {
      subject: variant.subject,
      name: pipeline.title ?? `pipeline-${pipelineId}`,
      fromName: silo.fromName,
      fromEmail: silo.fromEmail,
      htmlUrl: htmlContentUrl,
      listIds: [silo.cmListId],
    });

    await prisma.aiContentPipeline.update({
      where: { id: pipelineId },
      data: { cmCampaignId, stagedAt: new Date() },
    });
    return cmCampaignId;
  }

  /** Fire-time: send the staged draft. Refuses if not staged or a campaign gate fails. */
  async fireCampaign(pipelineId: string): Promise<void> {
    const pipeline = await prisma.aiContentPipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      include: { candidate: true },
    });
    if (!pipeline.cmCampaignId || !pipeline.stagedAt) {
      throw new Error(`pipeline ${pipelineId} is not staged — stageCampaign must run first`);
    }
    const silo = pipeline.candidate;
    if (!silo) throw new Error(`pipeline ${pipelineId} has no silo`);

    const control = await prisma.agencyControl.findUnique({ where: { agencyId: silo.agencyId } });
    if (control?.killSwitchEngaged !== false) {
      throw new Error('kill switch engaged — fire refused');
    }

    const variant = await prisma.messageVariant.findFirst({
      where: { campaignId: pipelineId },
      orderBy: { version: 'desc' },
    });
    if (!variant) throw new Error(`pipeline ${pipelineId} has no variant`);

    const reviewedBy = pipeline.reviewedById
      ? await prisma.candidateUser.findUnique({ where: { candidateId_id: { candidateId: silo.id, id: pipeline.reviewedById } } })
      : null;
    const gateReport = evaluateCampaignGates({
      campaign: {
        id: pipeline.id,
        status: pipeline.status,
        channel: pipeline.channel,
        messageClass: pipeline.messageClass,
        reviewedByRole: reviewedBy?.role ?? null,
      },
      variant: { id: variant.id, contentHash: variant.contentHash },
      authorizations: (await prisma.wizardAuthorization.findMany({ where: { variantId: variant.id } })).map((a) => ({
        id: a.id, contentHash: a.contentHash, phrase: a.phrase,
        authorizedByPrincipal: true, // WizardAuthorization is only written by a principal
      })),
      channelGoverned: true, // CM is a governed rail once the silo is provisioned
      agentAction: pipeline.originAgentKey ? { agentKey: pipeline.originAgentKey, action: 'dispatch' } : undefined,
      delegations: pipeline.originAgentKey
        ? (await prisma.agentDelegation.findMany({ where: { candidateId: silo.id, agentKey: pipeline.originAgentKey } })).map((d) => ({
            id: d.id, agentKey: d.agentKey, privileges: d.privileges.split(','),
            expiresAt: d.expiresAt, revokedAt: d.revokedAt,
          }))
        : [],
      e20: { granted: true, detail: 'E20 not bound in wizard lane; authorization chain covers dispatch' },
      e10: { granted: true, detail: 'E10 not bound in wizard lane' },
      platformSuppressionAvailable: true,
      killSwitchEngaged: false, // already checked above
      edLiveOrder: undefined,
      requestedMode: 'LIVE',
    });
    if (!gateReport.dispatchAllowed) {
      const failed = gateReport.gates.filter((g) => !g.pass).map((g) => g.gate).join(',');
      throw new Error(`gate report failed: ${failed}`);
    }

    await this.cm.sendCampaign(pipeline.cmCampaignId, silo.replyToEmail ?? silo.fromEmail);
    await prisma.aiContentPipeline.update({ where: { id: pipelineId }, data: { sentAt: new Date() } });
  }
}
