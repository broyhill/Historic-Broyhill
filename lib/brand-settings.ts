import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { emptyBrand, normalizeBrand, type BrandKit } from "@/lib/brand";

// The brand kit lives in one SETTINGS row of the campaigns table (same pattern as template-settings),
// so there is no new table. Never shown as a campaign or a template.
const NAME = "brand-kit";

export async function loadBrand(): Promise<BrandKit> {
  await ensureCampaignTable();
  const row = await prisma.emailCampaign.findFirst({ where: { status: "SETTINGS", name: NAME }, select: { recipientFilter: true } });
  return row ? normalizeBrand(row.recipientFilter) : emptyBrand();
}

export async function saveBrand(brand: BrandKit): Promise<void> {
  await ensureCampaignTable();
  const json = normalizeBrand(brand) as unknown as Prisma.InputJsonValue;
  const row = await prisma.emailCampaign.findFirst({ where: { status: "SETTINGS", name: NAME }, select: { id: true } });
  if (row) await prisma.emailCampaign.update({ where: { id: row.id }, data: { recipientFilter: json } });
  else await prisma.emailCampaign.create({ data: { name: NAME, status: "SETTINGS", recipientFilter: json } });
}
