import type { Prisma } from '@prisma/client';
import { json, readJson, withAdmin } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { assertInSilo, requireSilo } from '@/lib/scope';
import { LifecycleError } from '@/lib/services/campaigns';
import { parseBlocks, validateTemplateEdit } from '@/lib/templates/blocks';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return withAdmin(request, 'template.read', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const { id } = await params;
    const template = assertInSilo(await prisma.emailTemplate.findUnique({ where: { id } }), silo, 'Template');
    return json({ template });
  });
}

// Saves blocks with section-lock enforcement: non-admins cannot alter, remove or unlock locked
// blocks (agency-owned disclaimers and footers).
export async function PUT(request: Request, { params }: Params) {
  return withAdmin(request, 'template.edit', async ({ tenant, actor }) => {
    const silo = requireSilo(tenant);
    const { id } = await params;
    const existing = assertInSilo(await prisma.emailTemplate.findUnique({ where: { id } }), silo, 'Template');
    const body = await readJson(request);
    const next = parseBlocks(body.blocks);
    const issues = validateTemplateEdit(parseBlocks(existing.blocks), next, actor.role);
    if (issues.length) return json({ error: 'Locked sections cannot be changed', issues }, 403);
    if (typeof body.version !== 'number' || body.version !== existing.version) {
      throw new LifecycleError(409, `Template changed since you opened it (now version ${existing.version})`);
    }
    const updated = await prisma.emailTemplate.updateMany({
      where: { id, candidateId: silo.silo.id, version: existing.version },
      data: {
        blocks: next as unknown as Prisma.InputJsonValue,
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : existing.name,
        version: existing.version + 1,
        updatedById: actor.userId,
      },
    });
    if (updated.count !== 1) throw new LifecycleError(409, 'Template changed concurrently; reload');
    return json({ template: await prisma.emailTemplate.findUnique({ where: { id } }) });
  });
}
