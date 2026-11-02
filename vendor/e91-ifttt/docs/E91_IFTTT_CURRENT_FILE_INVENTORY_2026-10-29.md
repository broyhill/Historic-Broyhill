# E91 IFTTT Rules Fabric — Current File Inventory

- **Status:** READ-ONLY INVENTORY · NO PLACEMENT · NO COPY · NO DATABASE WRITE
- **Evidence revision:** `origin/main` `a6b53b2cba4ce19b1771196c5d08e9dd889af9b3`
- **Date:** 2026-10-29
- **Identity:** E91 = IFTTT Rules Fabric
**Parent table:** [`E91_IFTTT_PLACEMENT_TABLE_2026-10-17.md`](E91_IFTTT_PLACEMENT_TABLE_2026-10-17.md)

## Answer

The files needed to build IFTTT exist, but they are still spread across E91,
E60, E40, E41, E20 and the shared execution path. E91 is now registered and
has a README, but it does not contain an engine. The current executable engine
still sits under E60, the canonical rule table is defined elsewhere, E40 keeps
a separate workflow store, E41 uses a hard-coded workflow list, and E20 runs a
different `brain.triggers` path.

The app is therefore **identified but not assembled into one operating E91
path**.

## 1. E91 identity and placement records

| Role | Current path | State |
|---|---|---|
| E91 lane | `ECO_CANONICAL/E91/README.md` | Registered shelf; no engine code |
| registration ruling | `docs/canonical/E91_IFTTT_RULES_FABRIC_REGISTRATION_2026-10-08.md` | Current identity |
| placement table | `docs/canonical/E91_IFTTT_PLACEMENT_TABLE_2026-10-17.md` | Preserve-first map |
| original ruling | `docs/canonical/E91_IFTTT_RULING_2026-10-08.md` | Historical ruling record |
| current roster | `ecosystems.yaml` | E91 registered; E92–E95 holes |
| human roster | `docs/canonical/REGISTERED_PLATFORM_ROSTER_2026-09-13.md` | E91 amendment |
| Pixie-Stix law | `docs/canonical/PIXIE_STIX_WARNING_2026-10-09.md` | Placement before copy |

The October 17 placement table says no E91 folder existed at its evidence
revision. That statement is historical now: registration later added
`ECO_CANONICAL/E91/README.md`. It did not add the engine or schema.

## 2. Deterministic rule engine

### One byte identity, five current paths

SHA-256:

```text
305007f1f877b759498663dca6949aea97041963b9809408c7269f564e1ebe80
```

Paths:

```text
ecosystems/e60/iftt_engine.py
ECO_CANONICAL/E60/code/iftt_engine.py
AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/iftt_engine.py
AGENT_BOOT/ECO_LIBRARY_MULTIAGENT_SORT_WORKSPACE_2026-07-27/01_ECO_LIBRARIES_COPY/_live_ecosystems_py/e60/iftt_engine.py
STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/ecosystems/e60/iftt_engine.py
```

`AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/iftt_engine__2f021d.py`
has the same current bytes and hash despite its suffix.

### What the engine currently does

- defines `IFTTRule`, `IFTTEngine` and four in-memory seed rules;
- evaluates Python predicates;
- emits the shared `RuleFired` contract;
- attempts to persist fires to `core.iftt_rule_fires`;
- is re-exported by `ecosystems/e60/__init__.py`.

### What it does not currently do

- it does not select or load rows from canonical `ifttt.rules`;
- it does not call the E20 Brain gatekeeper;
- it does not call the Action Execution Socket;
- it does not poll the E00 event bus or a 60-second scheduler;
- no non-test Python code instantiates `IFTTEngine`.

The comment saying persisted SQL rules are preferred is not implemented by the
current class.

## 3. Shared contracts and host wire

| Role | Path | Current relationship |
|---|---|---|
| public E60 export | `ecosystems/e60/__init__.py` | imports and re-exports the engine |
| wire contracts | `shared/brain_pentad_contracts.py` | defines `CostEvent` and `RuleFired` |
| E60 host siblings | `ecosystems/e60/cost_ledger.py` | shared E60 package dependency |
| E60 host siblings | `ecosystems/e60/ml_optimizer.py` | shared E60 package dependency |

Removing the E60 engine path would break the public package export and its
tests. This is why E91 placement remains copy-and-pointer first, with caller
cutover later.

## 4. Engine tests

### Seed-rule test

SHA-256:

```text
9730141ed4a362c03d67c8f16b8f77be37afc1e6269b7b79f31451d2b879bbff
```

Paths:

```text
tests/test_e60_rule_firing.py
ECO_CANONICAL/E60/tests/test_e60_rule_firing.py
AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/test_e60_rule_firing.py
STRANDED_RESCUE_2026-05-23/from-cursor-mac/tests/test_e60_rule_firing.py
STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_rule_firing.py
```

### Pentad contract test

SHA-256:

```text
2a62df04fd76b0cf0a75ff8aa2e66330bb9a4e254a13d2c59a890fbee5ad628e
```

Paths:

```text
tests/test_e60_pentad_contract.py
ECO_CANONICAL/E60/tests/test_e60_pentad_contract.py
AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/test_e60_pentad_contract.py
STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/tests/test_e60_pentad_contract.py
```

These tests cover the four in-memory rules and shared payload types. They do
not cover canonical `ifttt.rules`, E20 gating, the action socket, scheduling,
cooldowns, E40 authoring or E41 campaign attachment.

The local test run on this VM could not collect because `psycopg2` is absent.
No passing-test claim is made by this inventory.

## 5. Rule registries and schema files

### Canonical registry

`migrations/phase_d_ml_schemas_v1_2026-05-29.sql` defines:

```text
ifttt.rules
ifttt.rule_fires
```

It includes the rule shape, cooldown and rate-limit fields, audit rows and ten
seed scaffolds.

### Marketo mechanics and proposal surface

`database/migrations/dryrun/DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql`
adds:

```text
event_constraints
person_predicate_sql
qualification_policy
qualification_interval
ifttt.rule_proposals
```

Its header records an earlier execution, but this inventory did not re-read the
live database. Current live shape and counts remain unverified.

There is a divergent recovery copy:

```text
AGENT_BOOT/ECOSYSTEM FILES/E20/NONDEPLOYED_ORPHANS/DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql
```

The current migration and recovery copy have different SHA-256 values and must
not be treated as twins.

### Frozen E60 predecessor

`database/migrations/200_e60_nervous_net.sql` defines:

```text
core.iftt_rules
core.iftt_rule_fires
core.cost_ledger
```

SHA-256:

```text
52e2c081f1ffb781ad835c302cb3610f025e48ebd859df852e4135584bf7f684
```

Five identical paths:

```text
database/migrations/200_e60_nervous_net.sql
ECO_CANONICAL/E60/sql/200_e60_nervous_net.sql
AGENT_BOOT/ECOSYSTEM FILES/E60/NONDEPLOYED_ORPHANS/200_e60_nervous_net.sql
STRANDED_RESCUE_2026-05-23/from-v8-bug-fixes/database/migrations/200_e60_nervous_net.sql
archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/migrations/200_e60_nervous_net.sql
```

The current E60 engine still writes the frozen predecessor fire table. The
canonical design says new work belongs in `ifttt.rules`.

### Rule packs and consumers

Current SQL files that extend or reference the canonical registry include:

```text
database/migrations/E79_E80_WIRING_INSTALL_2026-07-08.sql
database/migrations/dryrun/2026-07-04_DRYRUN_WORKFLOW_SEQUENCING_ENGINE.sql
database/migrations/dryrun/DRYRUN_BANT_TRIGGER_HOOK_2026-08-02.sql
database/migrations/dryrun/DRYRUN_E25_COALITION_ENGINE_2026-07-31.sql
database/migrations/dryrun/DRYRUN_E26_NURTURE_ROUTING_RULES_2026-06-20.sql
database/migrations/dryrun/DRYRUN_E48_VIDEO_QUEUE_2026-06-20.sql
database/migrations/dryrun/DRYRUN_E60_JOURNEY_SENSOR_2026-07-31.sql
database/migrations/dryrun/DRYRUN_E79_E80_WIRING_2026-07-08.sql
database/migrations/dryrun/DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql
database/migrations/dryrun/DRYRUN_MULTICHANNEL_FATIGUE_CAPS_2026-06-20.sql
database/migrations/dryrun/DRYRUN_ORG_CONDUIT_GRAPH_2026-07-31.sql
database/migrations/dryrun/DRYRUN_WIZARD_CHANNEL_WATERFALL_2026-07-08.sql
```

The E84 code-edge and semantic-edge dry runs also mention the tables, but they
are indexing evidence, not IFTTT runtime code.

## 6. E40 rule-authoring and workflow-control files

Primary current source:

```text
ecosystems/ecosystem_40_automation_control_panel_complete.py
ecosystems/ecosystem_40_automation_control_panel.py
```

Canonical copies:

```text
ECO_CANONICAL/E40/code/ecosystem_40_automation_control_panel_complete.py
ECO_CANONICAL/E40/code/ecosystem_40_automation_control_panel.py
```

The E40 implementation contains:

- trigger and action catalogs;
- visual workflow concepts;
- ON/OFF/TIMER controls;
- workflow processing and step execution;
- its own `automation_workflows`, `automation_steps`,
  `automation_enrollments`, `automation_executions` and control tables.

It does not use `ifttt.rules` as its backing registry. Its workflow tables are
therefore a separate implementation that must be reconciled, not silently
declared the E91 registry.

Several divergent recovery and deployed copies exist. They carry multiple
content hashes, so filename equality does not mean current-equivalent code.

## 7. E41 campaign-builder integration

Primary current sources:

```text
ecosystems/ecosystem_41_campaign_builder.py
ecosystems/ecosystem_41_campaign_builder_complete.py
```

Canonical copies:

```text
ECO_CANONICAL/E41/code/ecosystem_41_campaign_builder.py
ECO_CANONICAL/E41/code/ecosystem_41_campaign_builder_complete.py
```

Related UI copies:

```text
ECO_CANONICAL/E41/frontend/ecosystem_41_campaign_builder_ui.html
ECO_CANONICAL/E41/frontend/1766013160624_ecosystem_41_campaign_builder_ui.html
ECO_CANONICAL/E41/frontend/1766013160624_ecosystem_41_campaign_builder_ui 2.html
```

The builder:

- offers IFTTT selection in campaign Step 5;
- stores campaign attachments and ON/OFF/TIMER choices;
- claims to obtain workflows from E40;
- currently returns a hard-coded list from `_get_all_ifttt_workflows()`.

It does not read the canonical E91 registry.

## 8. E20 gatekeeper and execution path

Current files:

```text
backend/python/brain/brain_worker.py
backend/python/brain/registry_dispatcher.py
backend/python/api/action_socket.py
backend/python/api/socket_route.py
backend/python/api/weapon_executor.py
backend/python/workers/brain_event_processor.py
```

The E20 Brain Worker:

- loads and matches `brain.triggers`;
- checks cooldowns;
- records `brain.trigger_fire_history`;
- applies constitutional vetoes;
- writes decisions;
- dispatches through `brain.action_executors`.

The Action Execution Socket and registry dispatcher provide the controlled
execution arm.

No current Python code was found that reads `ifttt.rules` and connects it to
this E20 path. `brain.triggers` and `ifttt.rules` remain separate registries.

## 9. Other consumers and seams

| Ecosystem | Current files | Current role |
|---|---|---|
| E37 | `ecosystems/ecosystem_37_event_management.py`; `ecosystems/ecosystem_37_event_management_complete.py`; canonical copies under `ECO_CANONICAL/E37/code/` | local `automation_mode` ON/OFF/TIMER consumer |
| E73 | `ECO_CANONICAL/E73/ECO_MODEL.md`; `ECO_CANONICAL/E73/sql/2026-06-13_E73_SHARED_SENSE_LEARN_CARDS.sql`; `ECO_CANONICAL/E73/sql/2026-06-13_E73_SHARED_BENEFIT_VARIANCE.sql` | HEAL/LEARN and outcome surface; no direct current IFTTT evaluator found |
| E79/E80 | `ECO_CANONICAL/E79/sql/E79_E80_WIRING_INSTALL_2026-07-08.sql`; matching database migration and dry run | rule/event consumers |
| E01 | `ECO_CANONICAL/E01/sql/DRYRUN_BANT_TRIGGER_HOOK_2026-08-02.sql` | proposed canonical-registry extension |
| E25/E26/E48 | SQL rule packs listed above | proposed or staged consumer rules |

## 10. Core design documents and their copies

### Unified Trigger Fabric

Current canonical:

```text
docs/canonical/UNIFIED_TRIGGER_FABRIC_2026-06-15.md
```

Seven other current byte-identical copies carry SHA-256
`50ce01d270410c785aba9ec085b89f83fa5b2bad3e90194605d10d0184bcdd00`.
One archive recovery copy differs and must not be treated as the same revision.

### Volume XI Triggers

Current canonical:

```text
docs/canonical/BGOP_PLATFORM_PLAN_VOLUME_XI_TRIGGERS_2026-06-12.md
```

Nine current copies are byte-identical at SHA-256
`59e0468fac3ebf6f0f7f646feed27303e09ecc85a7ea84cffa03aacb5d9a6443`.

### Trigger Architecture

Current canonical:

```text
docs/canonical/BGOP_TRIGGER_ARCHITECTURE_2026-06-07.md
```

Eight current copies are byte-identical at SHA-256
`0e6f948e9be745ec24e955dd60ad040607c3537c1b62194e0ba2724d3854e4ae`.

## 11. What is missing for a properly operating E91 app

1. **E91 runtime package:** an approved E91 address or shim that preserves the
   E60 path while exposing the E91 identity.
2. **Canonical registry loader:** runtime code that loads active rows from
   `ifttt.rules`, not only four Python seed rules.
3. **Single evaluation path:** deterministic rule evaluation followed by the
   E20 gatekeeper, cooldown, veto and authorization rules.
4. **Single execution path:** approved actions must flow through the Action
   Execution Socket in OBSERVE before FIRE.
5. **Single audit path:** fires and outcomes need one canonical history, with a
   deliberate migration or adapter for `core.iftt_rule_fires`.
6. **E40 reconciliation:** the authoring UI must write or propose against
   `ifttt.rules`, not maintain an unrelated workflow registry as the authority.
7. **E41 reconciliation:** campaign Step 5 must query the E91 registry instead
   of a hard-coded workflow list.
8. **Event ingestion and scheduling:** connect event-bus events, webhooks and
   timed ticks to the evaluator.
9. **Cross-system tests:** event → rule → E20 gate → OBSERVE action → audit
   receipt, plus blocked, cooldown, veto and failure paths.
10. **Fresh live audit:** read-only verification of current `ifttt.*`,
    `core.iftt_*`, `brain.triggers`, action executors and runtime services.

## 12. Bottom line

The core files have been found. Nothing appears lost:

- the engine and tests are preserved in several identical copies;
- the canonical and frozen table definitions are preserved;
- the E40 authoring implementation, E41 campaign attachment, E20 gatekeeper
  and action socket are present;
- the governing specs and placement records are present.

The current problem is assembly and reconciliation, not absence. The repository
contains multiple incomplete paths that do not yet converge on one E91 runtime.

## Lineage — where the shelf already recorded IFTTT

- `AGENT_BOOT/ED_DROP_2026-10-27_ECOSYSTEM_DRIFT_BURIED_APPS/TWO_LOG_JOIN_OVERLAY.csv` carries the example row `E91-A-PLACEHOLDER`: `scan_path=ECO_CANONICAL/E60/code/iftt_engine.py`, `join_class=LOCKED_INVISIBLE`, `snapshot_class=TWO_SNAPSHOTS`, `e84_search_hit=UNBOUND`, inbound `E01 E20 E26 E48 E79` (the `ifttt.rules` writers named by `db_coupling_v3`), outbound `E30 E31 E32 E16 E17 E19 E33 E70`. This inventory is the evidence to replace that placeholder with real pointer + overlay rows, `copy_status=INDEX_ONLY`, `decision=PENDING_ED`.
- The two-log addendum (`ECOSYSTEM_RESTORATION_TWO_LOG_JOIN_ADDENDUM_2026-10-27.md` §8) already classifies IFTTT as `LOCKED_INVISIBLE`: the Graphify 2026-08-11 eco stamp has no E91, so E91 is restored from the scan log + checkout + `code_table_edges_v1.csv`, never from the eco stamp.
- `02_PARTIAL_APPS.csv` / `03_BURIED_FILES.csv` list E60 as "IFTTT runtime host with E20" (23 apps, 110 buried rows) and show E64 / E68 interfaces to E91; those rows are the census this inventory reconciles against, not a second count.
- End-to-end sequencing: [`ECOSYSTEM_APP_RECOVERY_END_TO_END_PLAN_2026-10-29.md`](ECOSYSTEM_APP_RECOVERY_END_TO_END_PLAN_2026-10-29.md) §0 and §7.1 (E91 is the dry canary).
