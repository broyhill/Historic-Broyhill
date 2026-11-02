import { json, withAdmin } from '@/lib/api';
import { prisma } from '@/lib/prisma';

// Telemetry ribbon: activity counts per type for the active silo, or per silo for the agency
// overview (agency admins only — enforced by the tenant resolver).
export async function GET(request: Request) {
  return withAdmin(request, 'telemetry.read', async ({ tenant }) => {
    if (tenant.kind === 'AGENCY') {
      const silos = await prisma.candidateSilo.findMany({ where: { agencyId: tenant.agencyId }, select: { id: true, slug: true, name: true } });
      const grouped = await prisma.subscriberActivity.groupBy({ by: ['candidateId', 'type'], where: { candidateId: { in: silos.map((s) => s.id) } }, _count: { _all: true } });
      return json({
        scope: 'AGENCY',
        silos: silos.map((s) => ({
          ...s,
          counts: Object.fromEntries(grouped.filter((g) => g.candidateId === s.id).map((g) => [g.type, g._count._all])),
        })),
      });
    }
    const grouped = await prisma.subscriberActivity.groupBy({ by: ['type'], where: { candidateId: tenant.silo.id }, _count: { _all: true } });
    const dispatch = await prisma.dispatchRecord.groupBy({ by: ['mode'], where: { candidateId: tenant.silo.id }, _count: { _all: true } });
    return json({
      scope: 'SILO',
      silo: tenant.silo.slug,
      activity: Object.fromEntries(grouped.map((g) => [g.type, g._count._all])),
      dispatch: Object.fromEntries(dispatch.map((g) => [g.mode, g._count._all])),
    });
  });
}
