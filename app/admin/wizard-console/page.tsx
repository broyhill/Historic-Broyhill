import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionFromCookieValue } from '@/lib/wizard/api';
import { CHANNELS, CONVERSATION_HOOK } from '@/lib/wizard/channels/registry';
import { ACTIVE_SILO_COOKIE, AGENCY_OVERVIEW_SLUG, SESSION_COOKIE, SILO_HEADER, requestedDispatchMode } from '@/lib/wizard/config';
import { prisma } from '@/lib/wizard/prisma';
import { prismaSiloLookup, resolveTenant, TenantError } from '@/lib/wizard/tenant';
import { CandidateSwitcher, type SwitcherOption } from './CandidateSwitcher';

export const dynamic = 'force-dynamic';

export default async function AgencyConsole() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await sessionFromCookieValue(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect('/admin/login');
  const user = await prisma.candidateUser.findUnique({ where: { id: session.uid }, include: { candidate: true } });
  if (!user) redirect('/admin/login');

  let tenant;
  try {
    tenant = await resolveTenant(
      { header: headerStore.get(SILO_HEADER), cookie: cookieStore.get(ACTIVE_SILO_COOKIE)?.value ?? null },
      { ...session, role: user.role },
      await prismaSiloLookup(),
    );
  } catch (error) {
    const message = error instanceof TenantError ? error.message : 'Unable to resolve workspace';
    return <main><h1>Wizard of Oz</h1><p className="error">{message}</p></main>;
  }

  const agencyId = user.candidate.agencyId;
  const [silos, control] = await Promise.all([
    prisma.candidateSilo.findMany({ where: user.role === 'AGENCY_ADMIN' ? { agencyId } : { id: user.candidateId }, orderBy: { name: 'asc' } }),
    prisma.agencyControl.findUnique({ where: { agencyId } }),
  ]);
  const options: SwitcherOption[] = [
    ...(user.role === 'AGENCY_ADMIN' ? [{ slug: AGENCY_OVERVIEW_SLUG, label: 'Agency Command — all candidates' }] : []),
    ...silos.map((s) => ({ slug: s.slug, label: s.candidateName ? `${s.candidateName} (${s.name})` : s.name })),
  ];
  const current = tenant.kind === 'AGENCY' ? AGENCY_OVERVIEW_SLUG : tenant.silo.slug;
  const killSwitch = control?.killSwitchEngaged ?? true;

  return (
    <main>
      <div className="bar">
        <div>
          <h1>Wizard of Oz — Agency Console</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Signed in as {user.displayName ?? user.email} · {user.role}{user.isCandidatePrincipal ? ' · candidate principal' : ''}
          </p>
        </div>
        {user.role === 'AGENCY_ADMIN' ? <CandidateSwitcher options={options} current={current} /> : null}
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card stat"><b className={killSwitch ? 'error' : ''}>{killSwitch ? 'ENGAGED' : 'released'}</b><span>Master kill switch</span></div>
        <div className="card stat"><b>{requestedDispatchMode()}</b><span>Dispatch runtime</span></div>
        <div className="card stat"><b>{tenant.kind === 'AGENCY' ? silos.length : tenant.silo.candidateName ?? '—'}</b><span>{tenant.kind === 'AGENCY' ? 'Candidate silos' : 'Named candidate'}</span></div>
      </div>

      {tenant.kind === 'AGENCY' ? <AgencyOverview silos={silos.map((s) => ({ id: s.id, name: s.name, slug: s.slug, candidateName: s.candidateName }))} /> : <SiloView siloId={tenant.silo.id} />}

      <h2>Channels governed by the agency layer</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Gun</th><th>Ecosystem</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>
            {[...CHANNELS, CONVERSATION_HOOK].map((c) => (
              <tr key={`${c.weapon}-${c.ecosystem}`}>
                <td>{c.weapon}</td>
                <td>{c.ecosystem} {c.name}</td>
                <td><span className={`tag ${c.status === 'GOVERNED' ? 'governed' : c.status === 'HOOKED' ? 'hooked' : ''}`}>{c.status}</span></td>
                <td style={{ color: 'var(--muted)' }}>{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

async function AgencyOverview({ silos }: { silos: Array<{ id: string; name: string; slug: string; candidateName: string | null }> }) {
  const ids = silos.map((s) => s.id);
  const [queue, activity] = await Promise.all([
    prisma.aiContentPipeline.groupBy({ by: ['candidateId', 'status'], where: { candidateId: { in: ids } }, _count: { _all: true } }),
    prisma.subscriberActivity.groupBy({ by: ['candidateId', 'type'], where: { candidateId: { in: ids } }, _count: { _all: true } }),
  ]);
  const count = (rows: typeof queue | typeof activity, id: string, key: string) =>
    rows.find((r) => r.candidateId === id && ('status' in r ? r.status : r.type) === key)?._count._all ?? 0;
  return (
    <>
      <h2>Agency command — all candidates</h2>
      <div className="card scroll">
        <table>
          <thead><tr><th>Silo</th><th>Pending review</th><th>Published</th><th>Delivered</th><th>Opened</th><th>Bounced</th><th>Complaints</th></tr></thead>
          <tbody>
            {silos.map((s) => (
              <tr key={s.id}>
                <td>{s.candidateName ?? s.name}<br /><code style={{ color: 'var(--muted)' }}>{s.slug}</code></td>
                <td>{count(queue, s.id, 'PENDING_REVIEW')}</td>
                <td>{count(queue, s.id, 'PUBLISHED')}</td>
                <td>{count(activity, s.id, 'DELIVERED')}</td>
                <td>{count(activity, s.id, 'OPENED')}</td>
                <td>{count(activity, s.id, 'BOUNCED')}</td>
                <td>{count(activity, s.id, 'COMPLAINED')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function SiloView({ siloId }: { siloId: string }) {
  const [pending, published, activity, dispatch, siloSuppressions, subscribers, held] = await Promise.all([
    prisma.aiContentPipeline.findMany({ where: { candidateId: siloId, status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.aiContentPipeline.count({ where: { candidateId: siloId, status: 'PUBLISHED' } }),
    prisma.subscriberActivity.groupBy({ by: ['type'], where: { candidateId: siloId }, _count: { _all: true } }),
    prisma.dispatchRecord.groupBy({ by: ['mode'], where: { candidateId: siloId }, _count: { _all: true } }),
    prisma.siloSuppression.count({ where: { candidateId: siloId } }),
    prisma.subscriber.count({ where: { candidateId: siloId } }),
    prisma.subscriber.count({ where: { candidateId: siloId, identityState: 'HELD_MISSING_EVIDENCE' } }),
  ]);
  const a = (type: string) => activity.find((r) => r.type === type)?._count._all ?? 0;
  const d = (mode: string) => dispatch.find((r) => r.mode === mode)?._count._all ?? 0;
  return (
    <>
      <h2>Telemetry ribbon</h2>
      <div className="grid">
        {['CAPTURED', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'].map((t) => (
          <div key={t} className="card stat"><b>{a(t)}</b><span>{t.toLowerCase()}</span></div>
        ))}
      </div>
      <h2>Audience and dispatch</h2>
      <div className="grid">
        <div className="card stat"><b>{subscribers}</b><span>subscribers</span></div>
        <div className="card stat"><b>{held}</b><span>held — no exact RNC_RegID</span></div>
        <div className="card stat"><b>{siloSuppressions}</b><span>silo suppressions</span></div>
        <div className="card stat"><b>{d('DRY_RUN')}</b><span>dry-run dispatches</span></div>
        <div className="card stat"><b>{d('LIVE')}</b><span>live sends</span></div>
        <div className="card stat"><b>{published}</b><span>published, awaiting authorization</span></div>
      </div>
      <h2>Review queue — pending agency approval</h2>
      <div className="card scroll">
        {pending.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>Nothing is waiting for review.</p> : (
          <table>
            <thead><tr><th>Title</th><th>Channel</th><th>Class</th><th>Staged</th></tr></thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id}><td>{c.title ?? c.id}</td><td>{c.channel}</td><td>{c.messageClass}</td><td>{c.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
