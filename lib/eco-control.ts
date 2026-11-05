import { prisma } from "@/lib/prisma";

// One on/off switch per ecosystem, stored as a KnowledgeEntry in the
// "watch-control" folder (toggled from the ecosystem admin panels).
// Default = on when no row exists.
export async function ecoEnabled(key: string): Promise<boolean> {
  const ctl = await prisma.knowledgeEntry.findFirst({ where: { folder: "watch-control", title: key } });
  if (!ctl) return true;
  return (ctl.data as any).enabled !== false;
}
