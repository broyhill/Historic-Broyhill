// Control-plane telemetry: escalation-state rollup, fault-signature distribution, active
// incidents. Admin-scoped read; drives the self-healing dashboard view.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/wizard/prisma';
import { withAdmin } from '@/lib/wizard/api';
import { requireSilo } from '@/lib/wizard/scope';

export async function GET(request: Request) {
  return withAdmin(request, 'telemetry.read', async ({ tenant }) => {
    const silo = requireSilo(tenant).silo.id;
    const groups = await prisma.cpAnomalyLog.groupBy({
      by: ['escalationState'],
      where: { candidateId: silo },
      _count: { id: true },
      _sum: { blastRadiusScore: true },
    });
    const counts = { MONITORING: 0, HEALING_ACTIVE: 0, CIRCUIT_BROKEN: 0, HUMAN_INTERVENTION_REQUIRED: 0 };
    let blastRadius = 0;
    for (const g of groups) {
      if (g.escalationState in counts) counts[g.escalationState as keyof typeof counts] = g._count.id;
      if (g.escalationState === 'CIRCUIT_BROKEN' || g.escalationState === 'HUMAN_INTERVENTION_REQUIRED') {
        blastRadius += g._sum.blastRadiusScore ?? 0;
      }
    }
    const incidents = await prisma.cpAnomalyLog.findMany({
      where: { candidateId: silo, NOT: { escalationState: 'MONITORING' } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { healingManifests: { orderBy: { resolvedAt: 'desc' }, take: 1 } },
    });
    return NextResponse.json({ counts, blastRadius, incidents });
  });
}
