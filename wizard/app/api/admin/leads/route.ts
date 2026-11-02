import { json, withAdmin } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireSilo, scoped } from '@/lib/scope';

export async function GET(request: Request) {
  return withAdmin(request, 'lead.read', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const leads = await prisma.leadProfile.findMany({ where: scoped(silo), orderBy: { createdAt: 'desc' }, take: 200 });
    const total = await prisma.leadProfile.count({ where: scoped(silo) });
    return json({ silo: silo.silo.slug, total, returned: leads.length, leads });
  });
}
