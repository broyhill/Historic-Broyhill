// C/B/V ledger sync: pull CM stats for LIVE campaigns <14d old and append one
// CampaignVarianceSnapshot per pass. Actuals land as history, not overwrites — the
// delta curve is the training data. Sequential loop keeps us inside CM rate limits.
import { prisma } from '../prisma';
import { CampaignMonitorProvider } from './provider';

export async function runVarianceLedgerSync(cm: CampaignMonitorProvider, lookbackDays = 14): Promise<number> {
  const window = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const campaigns = await prisma.aiContentPipeline.findMany({
    where: { sentAt: { gte: window }, cmCampaignId: { not: null } },
  });

  let written = 0;
  for (const campaign of campaigns) {
    try {
      const stats = await cm.readStats(campaign.cmCampaignId!);
      const bounceRate = stats.Sent > 0 ? stats.Bounces / stats.Sent : 0;
      // Realized revenue attribution comes from UPDATE webhook events post-send; until the
      // attribution feed exists, actualRevenue stays 0 and variance flags it as unmeasured.
      const actualRevenue = campaign.actualRevenue;

      await prisma.$transaction([
        prisma.campaignVarianceSnapshot.create({
          data: {
            pipelineId: campaign.id,
            actualOpens: stats.Opens,
            predictedOpens: campaign.predictedOpens,
            varianceOpens: stats.Opens - campaign.predictedOpens,
            actualClicks: stats.Clicks,
            predictedClicks: campaign.predictedClicks,
            varianceClicks: stats.Clicks - campaign.predictedClicks,
            actualRevenue,
            predictedRevenue: campaign.predictedRevenue,
            varianceRevenue: actualRevenue - campaign.predictedRevenue,
            bounceRate,
          },
        }),
        prisma.aiContentPipeline.update({
          where: { id: campaign.id },
          data: {
            actualOpens: stats.Opens,
            actualClicks: stats.Clicks,
            actualBounces: stats.Bounces,
            statsLastSyncAt: new Date(),
          },
        }),
      ]);
      written++;
    } catch (err) {
      console.error(`[ledger-sync] campaign ${campaign.id} skipped:`, err);
    }
  }
  return written;
}
