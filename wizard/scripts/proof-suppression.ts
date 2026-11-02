// Proof: suppressed addresses are blocked — silo and global scopes, class-aware — and a signed
// complaint webhook suppresses an address so the very next dispatch blocks it.
//   npm run proof:suppression

import { checkSuppression, mergeLevel, type SuppressionRow } from '../lib/compliance/suppression';
import { unboundPlatformSuppression } from '../lib/compliance/suppression';
import { dispatchCampaign } from '../lib/dispatch/courier';
import { unboundE10Clearance, unboundE20Go } from '../lib/dispatch/providers';
import { MemoryDispatchStore } from '../lib/dispatch/store-memory';
import { planForEvent, signSvix, verifySvix, type ResendEvent } from '../lib/webhooks/resend';
import { AGENCY_ID, DEMO_SILO, demoState } from '../tests/fixtures';

const ROWS: SuppressionRow[] = [
  { email: 'cy@example.com', level: 'BULK_ONLY', reason: 'one-click unsubscribe', scope: 'SILO' },
  { email: 'DI@Example.com ', level: 'ALL_EMAIL', reason: 'hard bounce', scope: 'GLOBAL' },
];

function deps(store: MemoryDispatchStore) {
  return {
    store, e20: unboundE20Go, e10: unboundE10Clearance, platformSuppression: unboundPlatformSuppression,
    transport: null, unsubscribeSecret: 'dev-only-unsubscribe-secret-not-for-production-0001',
    baseUrl: 'http://localhost:3000', requestedMode: 'DRY_RUN' as const, edLiveOrder: undefined,
    now: () => new Date('2026-10-15T18:00:00Z'), log: () => undefined,
  };
}

async function main() {
  console.log('=== 1. checkSuppression() — scope × level × message class ===');
  const cases: Array<[string, 'BULK' | 'EVENT_INVITATION' | 'PERSONAL']> = [
    ['cy@example.com', 'BULK'], ['cy@example.com', 'EVENT_INVITATION'], ['cy@example.com', 'PERSONAL'],
    ['di@example.com', 'BULK'], ['di@example.com', 'EVENT_INVITATION'], ['  Di@EXAMPLE.com', 'PERSONAL'],
    ['ada@example.com', 'BULK'], ['not-an-address', 'BULK'],
  ];
  for (const [email, cls] of cases) {
    const v = checkSuppression(email, cls, ROWS);
    console.log(`  ${(v.suppressed ? 'BLOCKED' : 'allowed').padEnd(8)} ${JSON.stringify(email).padEnd(20)} ${cls.padEnd(17)} ${v.blocking.map((b) => `${b.scope}/${b.level}/${b.reason}`).join('; ') || '—'}`);
  }

  console.log('\n=== 2. Courier: BULK dispatch to the demo list ===');
  const state = demoState();
  const store = new MemoryDispatchStore(state);
  const bulk = await dispatchCampaign(deps(store), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'proof' });
  for (const o of bulk.outcomes) console.log(`  ${o.mode.padEnd(10)} ${o.email.padEnd(18)} ${o.reason}`);

  console.log('\n=== 3. Same audience as an EVENT_INVITATION — bulk unsubscribe does not block it; hard bounce still does ===');
  const inviteState = demoState();
  inviteState.campaigns[0]!.messageClass = 'EVENT_INVITATION';
  const invite = await dispatchCampaign(deps(new MemoryDispatchStore(inviteState)), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'proof' });
  for (const o of invite.outcomes) console.log(`  ${o.mode.padEnd(10)} ${o.email.padEnd(18)} ${o.reason}`);

  console.log('\n=== 4. Signed Resend complaint webhook for ada@example.com → suppression → next dispatch blocks her ===');
  const secret = `whsec_${Buffer.from('dev-only-webhook-secret-0123456789').toString('base64')}`;
  const event: ResendEvent = { type: 'email.complained', created_at: '2026-10-15T18:05:00Z', data: { email_id: 'msg-dev-1', to: ['ada@example.com'] } };
  const body = JSON.stringify(event);
  const timestamp = '1792087500';
  const signature = await signSvix(secret, 'msg_dev_1', timestamp, body);
  const goodSig = await verifySvix({ id: 'msg_dev_1', timestamp, signature }, body, secret, 1792087500);
  const tampered = await verifySvix({ id: 'msg_dev_1', timestamp, signature }, body.replace('ada', 'eve'), secret, 1792087500);
  console.log(`  signature valid: ${goodSig}; tampered body accepted: ${tampered}`);
  for (const plan of planForEvent(event)) {
    if (!plan.suppression) continue;
    // Mirror of lib/services/telemetry.ts: write both scopes, escalate never downgrade.
    const silo = state.siloSuppressions.find((s) => s.candidateId === DEMO_SILO && s.email === plan.email);
    if (silo) silo.level = mergeLevel(silo.level, plan.suppression.level);
    else state.siloSuppressions.push({ candidateId: DEMO_SILO, email: plan.email, level: plan.suppression.level, reason: plan.suppression.reason });
    const global = state.globalSuppressions.find((s) => s.email === plan.email);
    if (global) global.level = mergeLevel(global.level, plan.suppression.level);
    else state.globalSuppressions.push({ agencyId: AGENCY_ID, email: plan.email, level: plan.suppression.level, reason: plan.suppression.reason });
    console.log(`  wrote SILO + GLOBAL suppression ${plan.email} level=${plan.suppression.level} reason="${plan.suppression.reason}"`);
  }
  // New variant id so the idempotency key is fresh and the courier re-evaluates everyone.
  state.variants[0]!.id = 'var-2';
  state.authorizations[0]!.variantId = 'var-2';
  const after = await dispatchCampaign(deps(store), { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'proof' });
  for (const o of after.outcomes) console.log(`  ${o.mode.padEnd(10)} ${o.email.padEnd(18)} ${o.reason}`);
  const ada = after.outcomes.find((o) => o.email === 'ada@example.com');
  console.log(`\nResult: ada@example.com is ${ada?.mode} after the complaint (was ${bulk.outcomes.find((o) => o.email === 'ada@example.com')?.mode} before).`);
  if (ada?.mode !== 'SUPPRESSED') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
