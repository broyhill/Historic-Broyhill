// Runtime verification of the real route handlers against a LOCAL dev database (the schema must
// already be pushed with Ed's phrase). Handlers are invoked in-process with real Request objects —
// no HTTP server, no network, no provider calls. Creates dev fixtures in the wizard_agency schema.
//   set -a; . ./.env.local; set +a; node --import tsx scripts/verify-routes-dev.ts

const url = new URL(process.env.WIZARD_AGENCY_DATABASE_URL ?? 'invalid://');
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || url.searchParams.get('schema') !== 'wizard_agency') {
  console.error('verify-routes-dev: REFUSED — local wizard_agency database only');
  process.exit(1);
}
// Checked before any fixture write so a refusal leaves the dev database untouched.
const DEV_USER_PASSWORD = process.env.WIZARD_DEV_USER_PASSWORD ?? '';
if (DEV_USER_PASSWORD.length < 12) {
  console.error('verify-routes-dev: REFUSED — set WIZARD_DEV_USER_PASSWORD (min 12 chars, see .env.example) for the dev fixture users');
  process.exit(1);
}

type Json = Record<string, any>;
type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface Check { step: string; expected: number; actual: number; note: string }
const checks: Check[] = [];

class Jar {
  private cookies = new Map<string, string>();
  absorb(setCookies: string[]) {
    for (const line of setCookies) {
      const [pair] = line.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      if (!name) continue;
      const value = rest.join('=');
      if (value) this.cookies.set(name.trim(), value);
      else this.cookies.delete(name.trim());
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function call(
  handler: Handler, method: string, path: string,
  opts: { body?: unknown; jar?: Jar; headers?: Record<string, string>; params?: Record<string, string>; raw?: string } = {},
) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.jar) headers.cookie = opts.jar.header();
  const request = new Request(`http://localhost:3000${path}`, {
    method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const response = await handler(request, opts.params ? { params: Promise.resolve(opts.params) } : undefined);
  const text = await response.text();
  let json: Json = {};
  try { json = JSON.parse(text) as Json; } catch { json = { text }; }
  opts.jar?.absorb(response.headers.getSetCookie());
  return { status: response.status, json };
}

function expect(step: string, expected: number, actual: number, note = '') {
  checks.push({ step, expected, actual, note });
}

async function main() {
  const { prisma } = await import('../lib/prisma');
  const { hashPassword } = await import('../lib/auth/password');
  const { WELCOME_JOURNEY } = await import('../lib/journeys/runner');
  const { createUnsubscribeToken } = await import('../lib/compliance/unsubscribe');
  const { signSvix } = await import('../lib/webhooks/resend');
  const { AGENCY_NAME } = await import('../lib/config');
  const login = (await import('../app/api/auth/login/route')).POST as Handler;
  const silos = await import('../app/api/admin/silos/route');
  const leads = await import('../app/api/admin/leads/route');
  const templates = await import('../app/api/admin/templates/route');
  const template = await import('../app/api/admin/templates/[id]/route');
  const compile = await import('../app/api/admin/templates/[id]/compile/route');
  const campaigns = await import('../app/api/admin/campaigns/route');
  const capture = await import('../app/api/capture/route');
  const webhook = await import('../app/api/webhooks/resend/route');
  const unsubscribe = await import('../app/api/unsubscribe/route');
  const killswitch = await import('../app/api/admin/killswitch/route');
  const telemetry = await import('../app/api/admin/telemetry/route');

  // ── dev fixtures (idempotent) ───────────────────────────────────────────────────────────────
  const agency = await prisma.agency.findFirstOrThrow({ where: { name: AGENCY_NAME } });
  const demo = await prisma.candidateSilo.upsert({
    where: { slug: 'demo-candidate' },
    create: {
      agencyId: agency.id, slug: 'demo-candidate', name: 'Demo Candidate (dev)', candidateName: 'Demo Candidate',
      committeeId: 'STA-DEV-0001', officeSought: 'NC Senate District 99 (dev fixture)', paidForBy: 'Paid for by Demo Candidate Committee (dev fixture)',
    },
    update: {},
  });
  const password = DEV_USER_PASSWORD;
  const hash = await hashPassword(password);
  const user = (email: string, role: 'CANDIDATE_MANAGER' | 'CAMPAIGN_DRAFTER' | 'COMPLIANCE_VIEWER', principal = false) =>
    prisma.candidateUser.upsert({
      where: { candidateId_email: { candidateId: demo.id, email } },
      create: { candidateId: demo.id, email, passwordHash: hash, role, isCandidatePrincipal: principal },
      update: { passwordHash: hash, role, isCandidatePrincipal: principal },
    });
  await Promise.all([
    user('manager@example.com', 'CANDIDATE_MANAGER'),
    user('candidate@example.com', 'CANDIDATE_MANAGER', true),
    user('drafter@example.com', 'CAMPAIGN_DRAFTER'),
    user('viewer@example.com', 'COMPLIANCE_VIEWER'),
  ]);
  const ada = await prisma.subscriber.upsert({
    where: { candidateId_email: { candidateId: demo.id, email: 'ada@example.com' } },
    create: { candidateId: demo.id, email: 'ada@example.com', firstName: 'Ada', rncRegId: 'RNC-DEV-0001', identityState: 'RNC_REGID_EXACT', venueInterest: 'The Dock' },
    update: {},
  });
  const bo = await prisma.subscriber.upsert({
    where: { candidateId_email: { candidateId: demo.id, email: 'bo@example.com' } },
    create: { candidateId: demo.id, email: 'bo@example.com', firstName: 'Bo' },
    update: {},
  });
  const list = await prisma.subscriberList.upsert({
    where: { candidateId_name: { candidateId: demo.id, name: 'Dev list' } },
    create: { candidateId: demo.id, name: 'Dev list', members: { create: [{ subscriberId: ada.id }, { subscriberId: bo.id }] } },
    update: {},
  });
  await prisma.automatedJourney.upsert({
    where: { candidateId_name: { candidateId: demo.id, name: 'Welcome (48h)' } },
    create: { candidateId: demo.id, name: 'Welcome (48h)', definition: WELCOME_JOURNEY as unknown as object, active: true },
    update: { active: true },
  });

  // ── sign-in, switching, isolation ───────────────────────────────────────────────────────────
  const admin = new Jar();
  const signIn = async (jar: Jar, siloSlug: string, email: string, pw: string) =>
    (await call(login, 'POST', '/api/auth/login', { body: { siloSlug, email, password: pw }, jar })).status;
  expect('agency admin signs in (broyhillgop)', 200, await signIn(admin, 'broyhillgop', process.env.WIZARD_SEED_ADMIN_EMAIL!, process.env.WIZARD_SEED_ADMIN_PASSWORD!));
  expect('wrong password refused', 401, await signIn(new Jar(), 'broyhillgop', process.env.WIZARD_SEED_ADMIN_EMAIL!, 'not-the-password-at-all'));
  const list1 = await call(silos.GET as Handler, 'GET', '/api/admin/silos', { jar: admin });
  expect('admin lists silos', 200, list1.status, `${list1.json.silos?.length} silos, canSwitch=${list1.json.canSwitch}`);
  expect('admin switches to demo-candidate', 200, (await call(silos.POST as Handler, 'POST', '/api/admin/silos', { body: { slug: 'demo-candidate' }, jar: admin })).status);

  const drafter = new Jar();
  const manager = new Jar();
  const candidate = new Jar();
  const viewer = new Jar();
  expect('drafter signs in (demo)', 200, await signIn(drafter, 'demo-candidate', 'drafter@example.com', password));
  expect('manager signs in (demo)', 200, await signIn(manager, 'demo-candidate', 'manager@example.com', password));
  expect('candidate principal signs in', 200, await signIn(candidate, 'demo-candidate', 'candidate@example.com', password));
  expect('compliance viewer signs in', 200, await signIn(viewer, 'demo-candidate', 'viewer@example.com', password));
  expect('drafter cannot switch silos', 403, (await call(silos.POST as Handler, 'POST', '/api/admin/silos', { body: { slug: 'broyhillgop' }, jar: drafter })).status);
  const cross = await call(leads.GET as Handler, 'GET', '/api/admin/leads', { jar: drafter, headers: { 'x-candidate-silo': 'broyhillgop' } });
  expect('drafter cannot read another silo via x-candidate-silo', 403, cross.status, cross.json.error);
  expect('no session → 401', 401, (await call(leads.GET as Handler, 'GET', '/api/admin/leads')).status);

  // ── studio: templates, locks, compile ───────────────────────────────────────────────────────
  const created = await call(templates.POST as Handler, 'POST', '/api/admin/templates', { body: { name: 'Dev invitation' }, jar: admin });
  expect('admin creates template in demo silo', 201, created.status);
  const tpl = created.json.template as Json;
  const lockedEdit = (tpl.blocks as Json[]).map((b) => (b.type === 'footer' ? { ...b, text: 'drafter rewrote the disclaimer' } : b));
  const lock = await call(template.PUT as Handler, 'PUT', `/api/admin/templates/${tpl.id}`, { body: { blocks: lockedEdit, version: tpl.version }, jar: drafter, params: { id: tpl.id } });
  expect('drafter edit of locked footer refused', 403, lock.status, (lock.json.issues ?? []).join('; '));
  const compiled = await call(compile.POST as Handler, 'POST', `/api/admin/templates/${tpl.id}/compile`, { body: { subject: 'Hello {{firstName}}' }, jar: drafter, params: { id: tpl.id } });
  expect('drafter compiles preview', 200, compiled.status, `html ${String(compiled.json.html ?? '').length} chars, 600px=${String(compiled.json.html).includes('width="600"')}`);

  // ── campaign lifecycle ──────────────────────────────────────────────────────────────────────
  const made = await call(campaigns.POST as Handler, 'POST', '/api/admin/campaigns', { body: { title: 'Dev reception invite', audienceListId: list.id }, jar: drafter });
  expect('drafter creates campaign', 201, made.status);
  const campaignId = made.json.campaign?.id as string;
  const patch = (jar: Jar, body: Json) => call(campaigns.PATCH as Handler, 'PATCH', '/api/admin/campaigns', { body: { id: campaignId, ...body }, jar });
  const composed = await patch(drafter, { action: 'COMPOSE', subject: 'An invitation for {{firstName}}', blocks: tpl.blocks });
  expect('drafter composes variant', 200, composed.status, `plan=${composed.json.plan} v${composed.json.variant?.version}`);
  const v1Hash = composed.json.variant?.contentHash as string;
  expect('drafter submits for review', 200, (await patch(drafter, { action: 'SUBMIT' })).status);
  expect('drafter cannot publish', 403, (await patch(drafter, { action: 'PUBLISH' })).status);
  expect('viewer cannot compose', 403, (await patch(viewer, { action: 'COMPOSE', subject: 'x', blocks: tpl.blocks })).status);
  expect('manager publishes (agency approval)', 200, (await patch(manager, { action: 'PUBLISH' })).status);
  expect('manager cannot authorize for the candidate', 403, (await patch(manager, { action: 'AUTHORIZE', phrase: 'I AUTHORIZE THIS ACTION', contentHash: v1Hash })).status);
  expect('candidate: wrong phrase refused', 400, (await patch(candidate, { action: 'AUTHORIZE', phrase: 'yes', contentHash: v1Hash })).status);
  expect('candidate: stale hash refused', 409, (await patch(candidate, { action: 'AUTHORIZE', phrase: 'I AUTHORIZE THIS ACTION', contentHash: 'deadbeef' })).status);
  expect('candidate authorizes exact hash', 201, (await patch(candidate, { action: 'AUTHORIZE', phrase: 'I AUTHORIZE THIS ACTION', contentHash: v1Hash })).status);
  const dispatched = await patch(manager, { action: 'DISPATCH' });
  expect('manager dispatches → dry-run', 200, dispatched.status, `mode=${dispatched.json.report?.effectiveMode} counts=${JSON.stringify(dispatched.json.counts)}`);
  const records = await prisma.dispatchRecord.findMany({ where: { campaignId }, select: { recipientEmail: true, mode: true, providerMessageId: true } });
  const frozen = await prisma.messageVariant.findFirst({ where: { campaignId, version: 1 }, select: { frozenAt: true, frozenReason: true } });
  expect('dispatch rows written, none LIVE', 2, records.length, records.map((r) => `${r.recipientEmail}:${r.mode}`).join(', '));
  expect('authorized variant frozen', 1, frozen?.frozenAt ? 1 : 0, frozen?.frozenReason ?? '');
  const revised = await patch(drafter, { action: 'COMPOSE', subject: 'A revised invitation for {{firstName}}', blocks: tpl.blocks });
  const after = await prisma.aiContentPipeline.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } });
  expect('edit after authorization → child variant, back to review', 200, revised.status, `plan=${revised.json.plan} v${revised.json.variant?.version} status=${after.status}`);
  const blocked = await patch(manager, { action: 'DISPATCH' });
  expect('dispatch of unreviewed child is BLOCKED', 409, blocked.status, `mode=${blocked.json.report?.effectiveMode}`);

  // ── capture, journeys ───────────────────────────────────────────────────────────────────────
  const pub = await call(capture.POST as Handler, 'POST', '/api/capture', { body: { candidateSlug: 'demo-candidate', email: 'Cy@Example.com', firstName: 'Cy', captureMethod: 'QR_PLACARD', vipScore: 99 } });
  expect('public QR capture (VIP score ignored)', 201, pub.status, `identity=${pub.json.identityState} journeys=${pub.json.enrolledJourneyIds?.length}`);
  const trusted = await call(capture.POST as Handler, 'POST', '/api/capture', {
    headers: { 'x-capture-secret': process.env.CAPTURE_WEBHOOK_SECRET! },
    body: { candidateSlug: 'demo-candidate', email: 'di@example.com', firstName: 'Di', phone: '+13365550100', captureMethod: 'NFC_TAP', vipScore: 90, roomInterest: 'The Loft' },
  });
  expect('NFC capture with secret enrolls journey', 201, trusted.status, `journeys=${trusted.json.enrolledJourneyIds?.length} staged=${trusted.json.stagedCampaignIds?.length}`);
  const staged = await prisma.aiContentPipeline.findMany({ where: { id: { in: (trusted.json.stagedCampaignIds ?? []) as string[] } }, select: { channel: true, status: true } });
  const run = await prisma.journeyRun.findFirst({ where: { subscriberId: trusted.json.subscriberId as string }, select: { state: true, nextEvalAt: true } });
  expect('journey staged an email for review and is waiting 48h', 1, staged.filter((s) => s.channel === 'EMAIL' && s.status === 'PENDING_REVIEW').length, `run=${run?.state} next=${run?.nextEvalAt?.toISOString()}`);
  expect('capture with wrong secret refused', 401, (await call(capture.POST as Handler, 'POST', '/api/capture', { headers: { 'x-capture-secret': 'wrong' }, body: { candidateSlug: 'demo-candidate', email: 'x@example.com' } })).status);

  // ── telemetry webhook, unsubscribe, kill switch ─────────────────────────────────────────────
  const event = JSON.stringify({ type: 'email.complained', created_at: new Date().toISOString(), data: { email_id: 'dev-msg-1', to: ['ada@example.com'] } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await signSvix(process.env.RESEND_WEBHOOK_SECRET!, `msg_${ts}`, ts, event);
  expect('unsigned webhook refused', 401, (await call(webhook.POST as Handler, 'POST', '/api/webhooks/resend', { raw: event, headers: { 'svix-id': 'x', 'svix-timestamp': ts, 'svix-signature': 'v1,bad' } })).status);
  const hook = await call(webhook.POST as Handler, 'POST', '/api/webhooks/resend', { raw: event, headers: { 'svix-id': `msg_${ts}`, 'svix-timestamp': ts, 'svix-signature': sig } });
  const global = await prisma.globalSuppression.findUnique({ where: { email: 'ada@example.com' } });
  expect('signed complaint → global suppression', 200, hook.status, `global=${global?.level ?? 'none'}`);
  const token = await createUnsubscribeToken(demo.id, bo.id, process.env.WIZARD_UNSUBSCRIBE_SECRET!);
  const unsub = await call(unsubscribe.POST as Handler, 'POST', `/api/unsubscribe?silo=demo-candidate&token=${encodeURIComponent(token)}`, { raw: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const siloRow = await prisma.siloSuppression.findUnique({ where: { candidateId_email: { candidateId: demo.id, email: 'bo@example.com' } } });
  expect('one-click unsubscribe → silo suppression', 200, unsub.status, `silo=${siloRow?.level ?? 'none'}`);
  expect('forged unsubscribe token refused', 400, (await call(unsubscribe.POST as Handler, 'POST', `/api/unsubscribe?silo=demo-candidate&token=${encodeURIComponent(token.slice(0, -2) + 'xx')}`)).status);
  expect('kill switch release without phrase refused', 400, (await call(killswitch.POST as Handler, 'POST', '/api/admin/killswitch', { body: { engaged: false }, jar: admin })).status);
  const ks = await call(killswitch.GET as Handler, 'GET', '/api/admin/killswitch', { jar: admin });
  expect('kill switch still engaged', 200, ks.status, `engaged=${ks.json.killSwitchEngaged}`);
  const tel = await call(telemetry.GET as Handler, 'GET', '/api/admin/telemetry', { jar: manager });
  expect('manager reads silo telemetry', 200, tel.status, JSON.stringify(tel.json.dispatch));

  // ── report ──────────────────────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const c of checks) {
    const ok = c.expected === c.actual;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(c.actual).padStart(3)}  ${c.step}${c.note ? `  — ${c.note}` : ''}${ok ? '' : `  (expected ${c.expected})`}`);
  }
  const live = await prisma.dispatchRecord.count({ where: { mode: 'LIVE' } });
  console.log(`\n${checks.length - failed}/${checks.length} checks passed · LIVE dispatch records in database: ${live}`);
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
