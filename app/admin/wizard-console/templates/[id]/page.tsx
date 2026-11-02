import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { sessionFromCookieValue } from '@/wizard/lib/api';
import { ACTIVE_SILO_COOKIE, SESSION_COOKIE, SILO_HEADER } from '@/wizard/lib/config';
import { prisma } from '@/wizard/lib/prisma';
import { prismaSiloLookup, resolveTenant } from '@/wizard/lib/tenant';
import { parseBlocks } from '@/wizard/lib/templates/blocks';
import { StudioEditor } from './StudioEditor';

export const dynamic = 'force-dynamic';

export default async function TemplateStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await sessionFromCookieValue(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/admin/login');
  const user = await prisma.candidateUser.findUnique({ where: { id: session.uid } });
  if (!user) redirect('/admin/login');
  const tenant = await resolveTenant(
    { header: headerStore.get(SILO_HEADER), cookie: cookieStore.get(ACTIVE_SILO_COOKIE)?.value ?? null },
    { ...session, role: user.role },
    await prismaSiloLookup(),
  );
  if (tenant.kind !== 'SILO') notFound();
  const template = await prisma.emailTemplate.findFirst({ where: { id, candidateId: tenant.silo.id } });
  if (!template) notFound();

  return (
    <main>
      <h1>Visual Studio — {template.name}</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        {tenant.silo.candidateName ?? tenant.silo.name} · version {template.version} · locked sections are agency-owned
      </p>
      <StudioEditor
        templateId={template.id}
        initialName={template.name}
        initialVersion={template.version}
        initialBlocks={parseBlocks(template.blocks)}
        canLock={user.role === 'AGENCY_ADMIN'}
        canEdit={user.role !== 'COMPLIANCE_VIEWER'}
      />
    </main>
  );
}
