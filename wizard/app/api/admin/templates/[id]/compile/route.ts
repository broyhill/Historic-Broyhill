import { json, readJson, withAdmin } from '@/lib/api';
import { publicBaseUrl } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { assertInSilo, requireSilo } from '@/lib/scope';
import { parseBlocks } from '@/lib/templates/blocks';
import { compileEmail, MERGE_TAGS, type MergeTag } from '@/lib/templates/compiler';

type Params = { params: Promise<{ id: string }> };

// Studio preview: compiles unsaved (or saved) blocks with sample merge values. Never sends.
export async function POST(request: Request, { params }: Params) {
  return withAdmin(request, 'template.read', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const { id } = await params;
    const template = assertInSilo(await prisma.emailTemplate.findUnique({ where: { id } }), silo, 'Template');
    const record = await prisma.candidateSilo.findUniqueOrThrow({ where: { id: silo.silo.id } });
    const body = await readJson(request);
    const blocks = parseBlocks(body.blocks ?? template.blocks);
    const sample = (body.merge && typeof body.merge === 'object' ? body.merge : {}) as Record<string, unknown>;
    const merge: Partial<Record<MergeTag, string>> = {
      firstName: 'Pat', lastName: 'Sample', venueInterest: 'The Magnolia Room',
      officeSought: record.officeSought ?? '', candidateName: record.candidateName ?? '',
    };
    for (const tag of MERGE_TAGS) if (typeof sample[tag] === 'string') merge[tag] = sample[tag] as string;
    const compiled = compileEmail(blocks, {
      subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject : template.name,
      preheader: typeof body.preheader === 'string' ? body.preheader : null,
      merge,
      compliance: {
        senderName: record.candidateName ?? record.fromName,
        physicalAddress: record.physicalAddress,
        paidForBy: record.paidForBy,
        unsubscribeUrl: `${publicBaseUrl()}/unsubscribe?silo=${encodeURIComponent(record.slug)}&token=preview`,
      },
    });
    return json(compiled);
  });
}
