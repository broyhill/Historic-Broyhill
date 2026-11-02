// Silo provisioning verb: creating a silo's CM rail = create client → master list → signed
// webhook, persisted onto CandidateSilo. Idempotent — re-running on a provisioned silo
// refreshes the webhook secret instead of duplicating the client.
import crypto from 'crypto';
import { prisma } from '../prisma';
import { CampaignMonitorProvider } from './provider';

export class CmSiloProvisioningEngine {
  constructor(private cm: CampaignMonitorProvider) {}

  async provisionSilo(candidateId: string, baseWebhookUrl: string): Promise<{ cmClientId: string; cmListId: string; cmWebhookId: string }> {
    const silo = await prisma.candidateSilo.findUniqueOrThrow({ where: { id: candidateId } });

    let cmClientId = silo.cmClientId;
    let cmListId = silo.cmListId;

    if (!cmClientId) {
      cmClientId = await this.cm.createClient(silo.name);
    }
    if (!cmListId) {
      cmListId = await this.cm.createList(cmClientId, `${silo.name} Master List`);
    }

    // Fresh secret on every provision/rotate; the URL carries tenant + token contexts.
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const webhookUrl = `${baseWebhookUrl}?tenantId=${candidateId}&token=${webhookSecret}`;

    if (silo.cmWebhookId && cmListId) {
      try { await this.cm.deleteWebhook(cmListId, silo.cmWebhookId); }
      catch (err) { console.warn(`[cm-provision] stale webhook ${silo.cmWebhookId} delete failed, continuing:`, err); }
    }
    const cmWebhookId = await this.cm.createWebhook(cmListId, webhookUrl);

    await prisma.candidateSilo.update({
      where: { id: candidateId },
      data: { cmClientId, cmListId, cmWebhookId, cmWebhookSecret: webhookSecret },
    });

    return { cmClientId, cmListId, cmWebhookId };
  }
}
