import { AUTHORIZATION_PHRASE } from '@/wizard/lib/config';
import { json, readJson, withAdmin } from '@/wizard/lib/api';
import { prisma } from '@/wizard/lib/prisma';
import { LifecycleError } from '@/wizard/lib/services/campaigns';

async function agencyIdFor(candidateId: string): Promise<string> {
  const silo = await prisma.candidateSilo.findUniqueOrThrow({ where: { id: candidateId }, select: { agencyId: true } });
  return silo.agencyId;
}

export async function GET(request: Request) {
  return withAdmin(request, 'campaign.read', async ({ actor }) => {
    const control = await prisma.agencyControl.findUnique({ where: { agencyId: await agencyIdFor(actor.homeCandidateId) } });
    return json({ killSwitchEngaged: control?.killSwitchEngaged ?? true, reason: control?.reason ?? 'no control row (fail closed)' });
  });
}

// Engaging needs nothing. Releasing needs the exact phrase — and is still only one of the seven
// live gates; it can never send anything by itself.
export async function POST(request: Request) {
  return withAdmin(request, 'killswitch.write', async ({ actor }) => {
    const body = await readJson(request);
    const engage = body.engaged !== false;
    if (!engage && body.phrase !== AUTHORIZATION_PHRASE) throw new LifecycleError(400, `Releasing the kill switch requires the exact phrase: ${AUTHORIZATION_PHRASE}`);
    const agencyId = await agencyIdFor(actor.homeCandidateId);
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : engage ? 'engaged by agency admin' : 'released by agency admin';
    const control = await prisma.agencyControl.upsert({
      where: { agencyId },
      create: { agencyId, killSwitchEngaged: engage, reason, updatedById: actor.userId },
      update: { killSwitchEngaged: engage, reason, updatedById: actor.userId },
    });
    return json({ killSwitchEngaged: control.killSwitchEngaged, reason: control.reason });
  });
}
