import type { Prisma } from '@generated/wizard-prisma';
import { json, readJson, withAdmin } from '@/lib/wizard/api';
import { prisma } from '@/lib/wizard/prisma';
import { requireSilo, scoped } from '@/lib/wizard/scope';
import { defaultBlocks } from '@/lib/wizard/templates/blocks';

export async function GET(request: Request) {
  return withAdmin(request, 'template.read', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const templates = await prisma.emailTemplate.findMany({ where: scoped(silo), orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, version: true, updatedAt: true } });
    return json({ templates });
  });
}

export async function POST(request: Request) {
  return withAdmin(request, 'template.edit', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const body = await readJson(request);
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Untitled template';
    const record = await prisma.candidateSilo.findUniqueOrThrow({ where: { id: silo.silo.id } });
    const disclaimer = record.paidForBy ?? `Sent on behalf of ${record.candidateName ?? record.name}.`;
    const template = await prisma.emailTemplate.create({
      data: { candidateId: silo.silo.id, name, blocks: defaultBlocks(disclaimer) as unknown as Prisma.InputJsonValue, createdById: actor.userId, updatedById: actor.userId },
    });
    return json({ template }, 201);
  });
}
