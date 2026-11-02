import { json, withAdmin } from '@/wizard/lib/api';
import { composerFromEnv } from '@/wizard/lib/orchestration/forge';
import { prisma } from '@/wizard/lib/prisma';
import { requireSilo } from '@/wizard/lib/scope';
import { runJourneyTick } from '@/wizard/lib/services/journeys';

// Advances due journey runs in the active silo. Stages drafts for review; never sends.
export async function POST(request: Request) {
  return withAdmin(request, 'journey.run', async ({ tenant }) => {
    const silo = requireSilo(tenant);
    const results = await runJourneyTick(prisma, silo.silo.id, composerFromEnv());
    return json({ silo: silo.silo.slug, advanced: results.length, results });
  });
}
