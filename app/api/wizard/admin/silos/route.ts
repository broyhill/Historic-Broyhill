import { ACTIVE_SILO_COOKIE, AGENCY_OVERVIEW_SLUG } from '@/lib/wizard/config';
import { json, readJson, withAdmin } from '@/lib/wizard/api';
import { prisma } from '@/lib/wizard/prisma';
import { prismaSiloLookup, resolveTenant } from '@/lib/wizard/tenant';

// Candidate switcher data: admins see every silo in their agency; everyone else sees their own.
export async function GET(request: Request) {
  return withAdmin(request, 'campaign.read', async ({ actor }) => {
    const home = await prisma.candidateSilo.findUniqueOrThrow({ where: { id: actor.homeCandidateId } });
    const silos = await prisma.candidateSilo.findMany({
      where: actor.role === 'AGENCY_ADMIN' ? { agencyId: home.agencyId } : { id: home.id },
      select: { id: true, slug: true, name: true, candidateName: true, officeSought: true },
      orderBy: { name: 'asc' },
    });
    return json({ silos, canSwitch: actor.role === 'AGENCY_ADMIN', agencyOverview: actor.role === 'AGENCY_ADMIN' ? AGENCY_OVERVIEW_SLUG : null });
  });
}

// Switch the active silo: validated through the same resolver every request uses, then pinned in
// the broyhill_active_silo cookie.
export async function POST(request: Request) {
  return withAdmin(request, 'silo.switch', async ({ session, actor }) => {
    const body = await readJson(request);
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const tenant = await resolveTenant({ header: slug }, { ...session, role: actor.role }, await prismaSiloLookup());
    const response = json({ ok: true, tenant: tenant.kind === 'SILO' ? { kind: 'SILO', slug: tenant.silo.slug, name: tenant.silo.name } : { kind: 'AGENCY' } });
    response.cookies.set(ACTIVE_SILO_COOKIE, slug, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return response;
  });
}
