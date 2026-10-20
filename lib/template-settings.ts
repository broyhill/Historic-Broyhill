import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { normalizeSettings, type TemplateSettings } from "@/lib/template-categories";

// The editable category/type lists live in one row of the existing campaigns table
// (status SETTINGS, name template-settings), so there is no extra table. That row is never
// shown as a campaign or a template.
const NAME = "template-settings";

export async function loadSettings(): Promise<TemplateSettings> {
  await ensureCampaignTable();
  const row = await prisma.emailCampaign.findFirst({ where: { status: "SETTINGS", name: NAME }, select: { recipientFilter: true } });
  return normalizeSettings(row?.recipientFilter);
}

export async function saveSettings(settings: TemplateSettings): Promise<void> {
  await ensureCampaignTable();
  const json = settings as unknown as Prisma.InputJsonValue;
  const row = await prisma.emailCampaign.findFirst({ where: { status: "SETTINGS", name: NAME }, select: { id: true } });
  if (row) await prisma.emailCampaign.update({ where: { id: row.id }, data: { recipientFilter: json } });
  else await prisma.emailCampaign.create({ data: { name: NAME, status: "SETTINGS", recipientFilter: json } });
}

export const isValidCategory = (settings: TemplateSettings, v: unknown): v is string =>
  typeof v === "string" && settings.categories.includes(v);
export const isValidKind = (settings: TemplateSettings, v: unknown): v is string =>
  typeof v === "string" && settings.kinds.includes(v);
