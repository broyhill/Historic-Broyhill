import type { SuppressionLevel } from '@generated/wizard-prisma';
import { json, readJson, withAdmin } from '@/lib/wizard/api';
import { normalizeEmail } from '@/lib/wizard/identity';
import { prisma } from '@/lib/wizard/prisma';
import { can } from '@/lib/wizard/rbac';
import { requireSilo, scoped } from '@/lib/wizard/scope';
import { LifecycleError } from '@/lib/wizard/services/campaigns';
import { mergeLevel } from '@/lib/wizard/compliance/suppression';

export async function GET(request: Request) {
  return withAdmin(request, 'suppression.read', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const [siloRows, globalCount] = await Promise.all([
      prisma.siloSuppression.findMany({ where: scoped(silo), orderBy: { createdAt: 'desc' } }),
      prisma.globalSuppression.count({ where: { agencyId: silo.silo.agencyId } }),
    ]);
    // Global rows are agency data: listed only to agency admins, counted for everyone.
    const globalRows = actor.role === 'AGENCY_ADMIN'
      ? await prisma.globalSuppression.findMany({ where: { agencyId: silo.silo.agencyId }, orderBy: { createdAt: 'desc' } })
      : null;
    return json({ silo: siloRows, globalCount, global: globalRows });
  });
}

export async function POST(request: Request) {
  return withAdmin(request, 'suppression.write', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) throw new LifecycleError(400, 'A valid email is required');
    const level: SuppressionLevel = body.level === 'ALL_EMAIL' ? 'ALL_EMAIL' : 'BULK_ONLY';
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 200) : 'manual';
    if (body.scope === 'GLOBAL') {
      if (!can(actor.role, 'suppression.global.write')) throw new LifecycleError(403, 'Only agency admins write global suppression');
      const existing = await prisma.globalSuppression.findUnique({ where: { email } });
      const row = await prisma.globalSuppression.upsert({
        where: { email },
        create: { agencyId: silo.silo.agencyId, email, level, reason, source: 'admin' },
        update: { level: mergeLevel(existing?.level, level) },
      });
      return json({ scope: 'GLOBAL', row }, 201);
    }
    const existing = await prisma.siloSuppression.findUnique({ where: { candidateId_email: { candidateId: silo.silo.id, email } } });
    const row = await prisma.siloSuppression.upsert({
      where: { candidateId_email: { candidateId: silo.silo.id, email } },
      create: { candidateId: silo.silo.id, email, level, reason, source: 'admin' },
      update: { level: mergeLevel(existing?.level, level) },
    });
    return json({ scope: 'SILO', row }, 201);
  });
}
