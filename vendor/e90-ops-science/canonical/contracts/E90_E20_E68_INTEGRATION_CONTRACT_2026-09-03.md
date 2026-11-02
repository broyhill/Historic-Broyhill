# E90 to E68 Wizard to E20 Integration Contract

**Version:** 0.1.0-controlled-draft  
**State:** INTERFACE DESIGN, NOT DEPLOYED, NOT LIVE PROOF  
**Purpose:** Connect E90 efficiency recommendations to the Wizard and E20 without creating a parallel authority or execution path.

## Controlling main-branch doctrine

- [Wizard-first identity freeze](https://github.com/broyhill/BroyhillGOP/blob/main/docs/canonical/ECO_IDENTITY_FREEZE_WIZARD_FIRST_2026-08-11.md), blob `7a6330ed0baae0830989f9a7c8ec4c6802db1f83`: E60 owns Campaign Profit/Dataiku; E72 assembles Campaign Plan Objects; E68 captures intent, presents plans, and authorizes; E20 brokers, performs GO/NO-GO, and dispatches after authorization.
- [E72 Campaign Planning Architecture](https://github.com/broyhill/BroyhillGOP/blob/main/AGENT_BOOT/ECOSYSTEM%20FILES/E72/E72_CAMPAIGN_PLANNING_ARCHITECTURE_2026-08-10.md), blob `30cd0dbd636e34e1835f8aee93a27ca1a698f5f0`: E72 returns the Campaign Plan Object to E68, and E68 sends authorization to E20.
- [Atomic Contract Governance](https://github.com/broyhill/BroyhillGOP/blob/main/docs/canonical/BROYHILLGOP_ATOMIC_CONTRACT_GOVERNANCE_2026-07-17.md), blob `d48e70be69d5d1d248eb1632bfb4251573cfb152`: facts, model outputs, recommendations, authorization, execution, and outcomes are distinct; AI confidence cannot grant authority.
- [Action Execution Socket](https://github.com/broyhill/BroyhillGOP/blob/main/docs/canonical/ACTION_EXECUTION_SOCKET_CONTRACT_2026-06-14.md), blob `b9a1a9c80a811737f115840cc42a6faa772c6366`: PREVIEW, OBSERVE, and FIRE are separate; the socket is the only execution bridge.

## Governing sentence

> E90 recommends an efficiency improvement; E72 binds campaign-facing recommendations into a plan; E68 explains and authorizes the exact version; E20 rechecks current conditions and routes only the permitted class of work.

No E90 output is executable by itself.

## Two integration lanes

### Campaign-efficiency lane

```text
E90 efficiency analysis
  -> E60/Dataiku predictive and quantitative inputs
  -> E90 versioned recommendation
  -> E72 incorporates it into a Campaign Plan Object
  -> E68 presents plan, efficiency effect, uncertainty, and alternatives
  -> authorized human approves the exact plan and E90 recommendation versions
  -> E20 rechecks current state
  -> Action Execution Socket handles any permitted external action
```

Campaign recommendations cannot bypass E72. E90 may improve allocation, timing, capacity, queueing, or expected resource use, but E72 remains the plan assembler.

### Platform-efficiency lane

```text
E90 efficiency analysis
  -> E90 versioned recommendation
  -> E68 Operations MGT review card
  -> authorized human approves, rejects, or holds
  -> E20 classifies and rechecks the requested effect
  -> advisory/configuration/work-order path
  -> affected ecosystem implements through its own governed change process
  -> E90 measures the resulting efficiency
```

Schema, code, infrastructure, and deployment changes do not go through the Action Execution Socket as campaign actions. E20 creates or routes an authorized implementation work order; the affected engineering and deployment controls remain in force.

## E90 recommendation classes

| Recommendation class | Required downstream route |
|---|---|
| `CAMPAIGN_PLAN_EFFICIENCY` | E72 plan binding, then E68, E20, and Socket if external |
| `QUEUE_POLICY_EFFICIENCY` | E68 authorization, E20 current-state check, affected queue owner |
| `CAPACITY_INVESTMENT` | E68 decision, then budget/procurement workflow |
| `DATA_QUALITY_EFFICIENCY` | E68 review when consequential, then source ecosystem owner |
| `MODEL_RECALIBRATION` | Model governance and validation; no automatic deployment |
| `CONFIGURATION_CHANGE` | E68 authorization and governed configuration workflow |
| `CODE_SCHEMA_DEPLOYMENT` | Engineering change control; never direct E20 execution |
| `ADVISORY_ONLY` | Record and display; no execution |

## Wizard Operations MGT card

E68 displays:

- recommendation ID, version, and content hash;
- one-sentence efficiency problem;
- affected ecosystems and handoffs;
- baseline window and proof state;
- bottleneck and waste class;
- proposed change;
- resource, quality, time, flow, and outcome efficiency effects;
- expected total efficiency improvement;
- uncertainty and downside;
- binding constraints and shadow prices;
- alternatives, including no action;
- implementation class and responsible owner;
- simulation or dry-run evidence;
- risks, rollback, and post-change measurement;
- expiry and invalidation conditions.

The Wizard provides `APPROVE EXACT VERSION`, `REJECT`, and `HOLD`. Editing any material field creates a new version and invalidates prior authorization.

## E20 acceptance gate

E20 accepts the recommendation only when:

1. the E90 envelope and content hash validate;
2. the recommendation is unexpired;
3. scope matches the authenticated tenant and candidate context;
4. the solver proof is admissible for the requested change class;
5. the E72 plan reference is present for campaign-facing recommendations;
6. the E68 authorization binds the exact recommendation and plan versions;
7. authorization is unrevoked and unconsumed;
8. current evidence, policy, budget, capacity, compliance, and health checks pass;
9. the affected ecosystem and implementation route are registered;
10. the requested effect does not exceed E90's authority.

Any mismatch returns `HOLD` or `REJECTED`. E20 never repairs an invalid recommendation silently.

## E20 route result

E20 returns exactly one:

- `ADVISORY_RECORDED`
- `E72_PLAN_REQUIRED`
- `IMPLEMENTATION_WORK_ORDER`
- `ACTION_SOCKET_PREVIEW`
- `ACTION_SOCKET_OBSERVE`
- `ACTION_SOCKET_FIRE_ELIGIBLE`
- `HOLD`
- `REJECTED`

`ACTION_SOCKET_FIRE_ELIGIBLE` is not proof that an action fired. The Socket must still issue its own execution receipt.

## State model

```text
DRAFT
  -> EVIDENCE_BOUND
  -> VALIDATED
  -> SIMULATED
  -> RECOMMENDED
  -> WIZARD_PRESENTED
  -> AUTHORIZED | REJECTED | HELD
  -> E20_ACCEPTED | E20_HELD | E20_REJECTED
  -> IMPLEMENTATION_REQUESTED
  -> OUTCOME_PENDING
  -> MEASURED
  -> VERIFIED | CORRECTED | REVERSED
```

Repository presence, simulation, and dry-run proof cannot skip any state or become runtime proof.

## E90 learning return

After an authorized improvement is implemented, E90 compares the same governed efficiency metrics before and after the change. It records:

- baseline and comparison windows;
- confounding events;
- expected and observed effect;
- uncertainty;
- quality, speed, resource, flow, and outcome changes;
- violations or adverse effects;
- rollback state;
- final verification judgment.

E90 learns whether the improvement worked. It does not rewrite another ecosystem's policy automatically.

