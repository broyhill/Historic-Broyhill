# E41 — HubSpot AI Campaign Wizard parity: process flow + tech stack
**Date:** 2026-10-02 · **Author:** Claude · **Status:** DRY-RUN, tested on scratch PG16 (14/14 pass), NOT applied
**Part 3 (same day, rulings G1–G5 implemented):** fatigue ceiling from `e10.fatigue_policy` across all journeys, `no_eligible_channel` terminal, `StudioCannonAdapter` (`e41_studio_cannon_adapter.py`), and two named dry-runs for G1/G2 awaiting Ed's phrase. 14/14 tests.
**Part 2 (same day, Ed authorized):** all 16 cannons registered dark, journey policy (goal/re-enrollment/quiet hours/blackout/fatigue/suppression), omni-channel `SEND_PREFERRED`, donor-group entry, reporting views. Requirements matrix: `HUBSPOT_WORKFLOW_ENGINE_REQUIREMENTS_MATRIX_2026-10-02.md`.

## Process flow (the 4 wizard steps → BGOP objects)
```
Step 1 Strategy & Q&A ─▶ StrategyAdvisor.suggest ─▶ wizard.wizard_session.strategy_qa
   target group size   = COUNT core.donor_profile WHERE <whitelisted filter>   (a donor group is a query over tattoos)
   optimal weapon mix  = weapons ranked by reachable, unsuppressed share
Step 2 Brief ──────────▶ wizard.wizard_session.brief
Step 3 Studio ─────────▶ wizard.channel_variation (one row per weapon; E30/E19/E33 studio editors hand payload back)
Step 4 Workflow ───────▶ wizard.wizard_session.workflow_dsl (canvas JSON: nodes + edges)
   Approve & Publish   = compile_session() → e41.journey_definition(draft, wizard_approved=false)
                                           + e41.journey_tile (weapon|wait|split|filter|webhook|exit; DAG expanded to tree)
                                           + e41.entry_source (brain_trigger w_wizard_workflow_published, enabled=false)
                                           + e41.control_state(off) + wizard.campaigns(draft)
   Ed phrase            = authorize() → status=approved, wizard_approved=true. control_state STILL off. Nothing is live.
Run                     = enroll() → e41.journey_position (one row per donor; UNIQUE = no re-enrollment)
                          Scheduler.advance() → one tile per hop:
                            weapon → e41_journey_engine.propose_step (dark: step_log only)
                            wait   → wait_until;   split → PredicateEvaluator → yes/no child
                            filter → continue or exit;   exit → w_journey_exited / w_journey_goal_met
```
The mockup diagram (email → wait 48h → opened? no→postcard / yes→social) is `EXAMPLE_DSL` in the module and is the routing test.

## Tech stack (what actually runs)
| Layer | HubSpot | BGOP |
|---|---|---|
| Wizard UI | AI Campaign Wizard | E68 frontstage (Claude Design build, not yet built) → `wizard.wizard_session` |
| Trigger taxonomy | Enrollment triggers | `brain.triggers` (607 rows; +T-W-115..118) · `e41.entry_source` |
| Actions | Workflow actions | `e41.action_catalog` → tile kinds → `brain.weapon_queue.action_type` |
| Branch predicates | If/then on contact events | `e41.predicate_catalog`, read from `journey.weapon_journey` + `brain.event_queue` |
| Journey definition | Workflow | `e41.journey_definition` / `journey_tile` (live since 07-28 schema, 0 rows) |
| Per-contact cursor | Workflow enrollment | `e41.journey_position` (NEW) |
| Scheduler | HubSpot's | `e41_wizard_workflow.Scheduler` (NEW) + `e41_journey_engine.propose_step` |
| Dispatch | HubSpot sends | E20 drain → E30/E31/E33/E19 executors (unchanged; E41 never fires) |
| Smart-Send | AI send-time optimization | per-donor local peak hour from `core.donor_profile.timezone_utc_offset`; E06 observed peaks later |
| Analytics | Campaign reports | `wizard.campaign_performance` (existing), `outcome.*` |

## Omni-channel orchestration (part 2)
```
SEND_PREFERRED tile ─▶ per donor at run time:
   e59.donor_segment_assignment ─▶ e59.microsegment_faction_crosswalk.primary_channel, secondary_channel
   ─▶ tile candidates ─▶ journey_policy.preferred_candidates ─▶ fallback
   each candidate must be: in e41.weapon_registry · reachable (core.donor_profile reach column) · not suppressed
every weapon tile, before propose: goal check → suppression → e10.blackout → max_touches_total → quiet hours / per-day cap / Smart-Send hold
```
Donor-group entry: `enroll_from_donor_groups(keys)` and `import_launch_context(e59.wizard_launch_context)`.

## Files in this change
- `database/migrations/dryrun/DRYRUN_E41_WIZARD_WORKFLOW_SCHEDULER_2026-10-02.sql` — part 1: 5 tables, 1 view, 2 catalogs seeded (15 actions, 11 predicates), 4 brain.triggers, 5 connection_registry edges; BEGIN…ROLLBACK, canary before/after
- `database/migrations/dryrun/DRYRUN_E41_OMNICHANNEL_WEAPON_REGISTRY_AND_POLICY_2026-10-02.sql` — part 2: `e41.weapon_registry` (16), 12 dark `brain.action_executors`, +10 weapon actions + `SEND_PREFERRED`, +4 predicates, `e41.journey_policy`, `e41.journey_suppression`, 3 reporting views, 17 connection edges
- `ECO_CANONICAL/E41/code/e41_studio_cannon_adapter.py` — ONE adapter interface keyed by W-code (G5); 16 cannons, channel validators for W01/W02/W03/W05/W06, W14 CM-CC rule
- `database/migrations/dryrun/DRYRUN_E20_RETIRE_MISECOED_EXECUTORS_E16_E18_2026-10-02.sql` (G1) · `DRYRUN_E30_EXECUTOR_EVENT_CLASS_FIX_2026-10-02.sql` (G2) — each needs Ed's phrase
- `ECO_CANONICAL/E41/code/e41_wizard_workflow.py` — StrategyAdvisor, WorkflowDSL, compile_session, authorize, enroll, PredicateEvaluator, Scheduler
- `ECO_CANONICAL/E41/taxonomies/E41_HUBSPOT_WORKFLOW_PARITY_TAXONOMY_2026-10-02.yaml`
- `ECO_CANONICAL/E41/tests/test_e41_wizard_workflow.py` — 11 tests on scratch PG16 via pgserver (routing, omni-channel resolution, goal/sibling unenroll, quiet hours + blackout, launch-context import, 16-weapon registry)
- `ECO_CANONICAL/E41/docs/HUBSPOT_WORKFLOW_ENGINE_REQUIREMENTS_MATRIX_2026-10-02.md` — 60-row capability matrix, 5 rulings, 5 open gaps
- `ECO_CANONICAL/E41/docs/E41_HUBSPOT_WIZARD_PARITY_2026-10-02.md` — this file

## Not done / blockers
- Apply needs Ed's exact phrase; then `ROLLBACK`→`COMMIT` and un-comment the `ops.deploy_log` insert.
- E68 frontstage HTML for steps 2–4 is not built (July state unchanged). This PR is the backstage engine the frontstage calls.
- `wizard.campaigns.candidate_id` is UUID; the e41 lane is INTEGER. `wizard_session.candidate_uuid` carries both until the candidate crosswalk lands.
- Predicates read E20's ledger, so while `PROPOSALS_ENABLED=False` every branch takes the "No" path by design.
- `ECO_CANONICAL/E41/ECO_MODEL.md` still says "no canonical DDL on repo" — stale since E41_CAMPAIGN_BUILDER_SCHEMA_V1_2026-07-28.sql; fix on the next lane pass.
