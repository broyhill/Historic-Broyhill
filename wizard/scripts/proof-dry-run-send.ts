// Proof: a dev-mode dispatch of a published, candidate-authorized campaign produces a dry-run
// log and sends nothing. Runs on the in-memory store — no database, no network, no transport.
//   npm run proof:dry-run

import { unboundPlatformSuppression } from '../lib/compliance/suppression';
import { dispatchCampaign } from '../lib/dispatch/courier';
import { unboundE10Clearance, unboundE20Go } from '../lib/dispatch/providers';
import { MemoryDispatchStore } from '../lib/dispatch/store-memory';
import { demoState, DEMO_SILO } from '../tests/fixtures';

async function main() {
  const state = demoState();
  const store = new MemoryDispatchStore(state);
  const lines: string[] = [];
  const deps = {
    store,
    e20: unboundE20Go,
    e10: unboundE10Clearance,
    platformSuppression: unboundPlatformSuppression,
    transport: null,
    unsubscribeSecret: 'dev-only-unsubscribe-secret-not-for-production-0001',
    baseUrl: 'http://localhost:3000',
    requestedMode: 'DRY_RUN' as const,
    edLiveOrder: undefined,
    now: () => new Date('2026-10-15T18:00:00Z'),
    log: (line: string) => {
      lines.push(line);
      console.log(line);
    },
  };

  console.log('=== Dispatch 1: BULK campaign, NODE_ENV=development, every live gate in its default state ===');
  const first = await dispatchCampaign(deps, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'user-manager-dev' });
  console.log('\nGate report:');
  for (const g of first.report.gates) console.log(`  ${g.pass ? 'PASS' : 'FAIL'}  [${g.tier}] ${g.gate} — ${g.detail}`);
  console.log(`\nEffective mode: ${first.report.effectiveMode}`);
  console.log('Per recipient:');
  for (const o of first.outcomes) console.log(`  ${o.mode.padEnd(10)} ${o.email.padEnd(18)} ${o.reason}`);
  console.log(`Counts: ${JSON.stringify(first.counts)}`);
  console.log(`DispatchRecords written: ${state.dispatches.length} (modes: ${state.dispatches.map((d) => d.mode).join(', ')})`);
  console.log(`Live provider calls: 0 (transport is null; effective mode ${first.report.effectiveMode})`);

  console.log('\n=== Dispatch 2: same request again — idempotent, no new records ===');
  const before = state.dispatches.length;
  const second = await dispatchCampaign({ ...deps, log: () => undefined }, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'user-manager-dev' });
  console.log(`Records before ${before}, after ${state.dispatches.length}; duplicates flagged: ${second.outcomes.filter((o) => o.duplicate).length}`);

  console.log('\n=== Dispatch 3: campaign not yet PUBLISHED → BLOCKED, nothing written ===');
  const blockedState = demoState();
  blockedState.campaigns[0]!.status = 'PENDING_REVIEW';
  blockedState.campaigns[0]!.reviewedByRole = null;
  const blocked = await dispatchCampaign({ ...deps, store: new MemoryDispatchStore(blockedState), log: () => undefined }, { candidateId: DEMO_SILO, campaignId: 'cmp-1', requestedById: 'user-drafter-dev' });
  console.log(`Effective mode: ${blocked.report.effectiveMode}; records written: ${blockedState.dispatches.length}`);
  console.log(`  ${blocked.report.gates.filter((g) => !g.pass && g.tier === 'DISPATCH').map((g) => `${g.gate}: ${g.detail}`).join('\n  ')}`);

  console.log('\n=== Dispatch 4: another silo cannot reach this campaign ===');
  try {
    await dispatchCampaign({ ...deps, log: () => undefined }, { candidateId: 'silo-broyhillgop', campaignId: 'cmp-1', requestedById: 'user-other' });
    console.log('UNEXPECTED: dispatch succeeded across silos');
    process.exitCode = 1;
  } catch (error) {
    console.log(`Refused: ${(error as Error).message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
