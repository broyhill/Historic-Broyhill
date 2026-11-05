# HubSpot Workflow Engine → BGOP Requirements Matrix
**Date:** 2026-10-02 · **Author:** Claude · **Authorized by:** Ed (2026-10-02) · **Live state:** relay SQL against Hetzner, same day
**Scope:** every HubSpot workflow / AI Campaign Wizard capability, mapped to the BGOP ecosystem that owns it, what exists live, the gap, and where it lands. Rows marked **PR #1082** are implemented in that branch (dry-run). Rows marked **RULING** need Ed.
**Vocabulary:** donor group (never microsegment). Column names on read-only tables quoted as-is.

## A. Wizard (HubSpot AI Campaign Wizard, 4 steps)
| # | HubSpot capability | BGOP owner | Exists live (verified) | Gap | Lands |
|---|---|---|---|---|---|
| A1 | Step 1 Strategy & Q&A — target size, offer, channel mix | E68 → E41 | `wizard.campaigns` (1 row), `wizard.drafts`, `wizard.wizard_nodes` 11 | no session object for the 4-step flow | **PR #1082** `wizard.wizard_session.strategy_qa`, `StrategyAdvisor` |
| A2 | AI-suggested audience from a prompt | E59 + E13 | `e59.wizard_launch_context` (0 rows, 46 cols incl. ask ladder, subject lines, pre-loaded cluster_ids), `e59.donor_segment_assignment` 265,779 | wizard never read launch context | **PR #1082** `import_launch_context`, `donor_group_size`, `enroll_from_donor_groups` |
| A3 | Step 2 Multi-channel brief | E68 | — | — | **PR #1082** `wizard_session.brief` |
| A4 | Step 3 per-channel studio editors ("Launch Email Studio…") | E30 / E19 / E33 / E31 / E17 … | E30, E31, E17, E19 schemas live; E33 schema absent | per-channel artifact store for the wizard | **PR #1082** `wizard.channel_variation`; studio adapters per E68 GOD FILE contract — NOT BUILT |
| A5 | Generate all variations (AI) | E80 Composition / E48 DNA | not audited this session | AI generation call | OPEN — E80 adapter |
| A6 | Step 4 canvas (trigger → send → delay → if/then) | E41 | `e41.journey_tile` kinds weapon/wait/split/filter/webhook/exit (live, 0 rows) | compiler from canvas JSON | **PR #1082** `WorkflowDSL`, `compile_session` |
| A7 | Save as Draft / Approve & Publish | E68 → E41 | `journey_definition.status`, `wizard_approved` | state separation enforced | **PR #1082** `state` CHECK (no "live"), `authorize()` exact phrase |
| A8 | AI Smart-Send (per-recipient peak time) | E41 / E06 | `core.donor_profile.timezone_utc_offset` | observed per-donor peak hour | **PR #1082** v0 = local 10:00; E06 observed peaks — OPEN |

## B. Enrollment triggers
| # | HubSpot capability | BGOP owner | Exists live | Gap | Lands |
|---|---|---|---|---|---|
| B1 | Event-based enrollment (form, email open, deal won) | E20 → E41 | `brain.triggers` 607 rows (email.*, sms.*, mail.*, social.*, d_* 45, w_* 14); `e41.entry_source.brain_trigger` | 4 wizard lifecycle codes | **PR #1082** T-W-115..118 |
| B2 | Property-change enrollment (contact property changed) | E13 tattoo / E59 | `s_segment_enter__*` 64, `transition` class; `h_heat_gear*` 80 | none — already richer than HubSpot | — |
| B3 | Deal-stage enrollment | E99 lead scoring / E39 pipeline | `l_donor_advances_to_stage_*` 19; `EXEC_E39_PIPELINE` registered | none | — |
| B4 | List-based (static/active list) | E59 donor groups | `e59.donor_segment_assignment` 265,779 / 131 keys; `entry_source.segment_membership` | wizard never enrolled from groups | **PR #1082** `enroll_from_donor_groups` |
| B5 | Manual / API enrollment | E41 | `entry_source.manual_list`, `api_call` | — | — |
| B6 | Re-enrollment rules per trigger | E41 | none | policy | **PR #1082** `journey_policy.re_enrollment` never/after_exit/after_days |
| B7 | Scheduled (date-property) enrollment | E40 timers | `e41.control_state.timer_cron`, `brain.triggers` schedule class 21 | — | — |

## C. Actions (16 cannons)
| # | HubSpot action | BGOP cannon | Executor live (brain.action_executors) | Gap | Lands |
|---|---|---|---|---|---|
| C1 | Send email | W01 E30 | `EXEC_E30_EMAIL_SEND` (dark) — sole E30 row since deploy 64 (07-27); event_class `donation.received` is the defect → G2 dry-run | — | catalog `SEND_EMAIL` |
| C2 | Send SMS | W02 E31 | `EXEC_E31_SMS_SEND` (dark) | — | `SEND_SMS` |
| C3 | — | W03 E74 MMS | none | register | **PR #1082** `EXEC_E74_MMS_SEND` dark |
| C4 | — | W04 E17 RVM | `EXEC_E17_RVM_DROP` (dark) | — | `SEND_RVM` |
| C5 | Direct mail (integration) | W05 E33 | `EXEC_E16_DIRECT_MAIL` — **mail registered under E16** | **RULING**: retire/re-eco the E16 row | **PR #1082** adds `EXEC_E33_DIRECT_MAIL` dark; E16 row untouched |
| C6 | Social post / ad audience | W06 E19 | `EXEC_E19_SOCIAL_POST` (dark) | — | `SEND_SOCIAL` |
| C7 | Create task → teammate | W07 E71 volunteer | none | register | **PR #1082** `EXEC_E71_VOLUNTEER_DEPLOY` dark |
| C8 | — | W08 E16 TV/radio | none | register (audience weapon) | **PR #1082** `EXEC_E16_TV_RADIO_SPOT` dark |
| C9 | — | W09 E46 broadcast | none | register (audience weapon) | **PR #1082** `EXEC_E46_BROADCAST_STREAM` dark |
| C10 | Register for event | W10 E34 town hall | e34 schema live; no executor | register | **PR #1082** `EXEC_E34_TOWNHALL_INVITE` dark |
| C11 | App push | W11 E67 | none | register | **PR #1082** `EXEC_E67_PUSH_SEND` dark |
| C12 | In-app message | W12 E69 messenger | none | register | **PR #1082** `EXEC_E69_MESSENGER_SEND` dark |
| C13 | Add to ads audience | W13 E70 | none | register (audience weapon) | **PR #1082** `EXEC_E70_DIGITAL_AD_AUDIENCE` dark |
| C14 | 1:1 sales email (as rep) | W14 E75 candidate personal | none | register; CM-CC rule lives in executor | **PR #1082** `EXEC_E75_CANDIDATE_PERSONAL` dark |
| C15 | 1:1 sales email (as manager) | W15 E76 manager personal | none | register | **PR #1082** `EXEC_E76_MANAGER_PERSONAL` dark |
| C16 | Create task (call) | W16 E32 phone | `EXEC_E18_PHONE_CALL` — **phone registered under E18** | **RULING**: retire/re-eco the E18 row | **PR #1082** adds `EXEC_E32_PHONE_CALL` dark; E18 row untouched |
| C17 | Send via contact's preferred channel (no native) | E41 ⇐ E59 | `e59.microsegment_faction_crosswalk.primary_channel/secondary_channel` (email 23, mail 9 …) | omni-channel resolver | **PR #1082** `SEND_PREFERRED` + `Scheduler._resolve_preferred` (group pref → reachable → not suppressed → candidates → fallback) |
| C18 | Delay (fixed) | E41 | `journey_tile.wait_seconds` | scheduler | **PR #1082** `Scheduler` wait |
| C19 | Delay until event | E41 | none | — | **PR #1082** `wait_event` + `resume_on_event` |
| C20 | If/then branch | E41 | `tile_kind='split'` | evaluator | **PR #1082** `PredicateEvaluator` |
| C21 | Value-equals branch (N-way) | E41 | — | — | **PR #1082** `BRANCH_VALUE` / `ATTR_EQUALS` (2-way today; N-way labels supported by `branch_label`, compiler emits yes/no only — OPEN) |
| C22 | Set property / internal notification / webhook | E41 → E55 | `tile_kind='webhook'` | — | catalog `WEBHOOK` (proposal only) |
| C23 | Enroll in another workflow | E41 | none | — | OPEN (cross-journey enroll action) |
| C24 | A/B at action level | E22 | `e22.experiments/variations/assignments/bandit_arms` live | tile → experiment link | **PR #1082** `journey_policy.ab_experiment_id`, tile `ab_variants` carried; assignment call — OPEN |

## D. Branch predicates
| # | HubSpot | BGOP source of truth | Lands |
|---|---|---|---|
| D1 | Email opened / clicked / replied / bounced | `journey.weapon_journey.engaged_at/responded_at` (E20 ledger), `brain.event_queue` | **PR #1082** `EMAIL_OPENED/CLICKED/REPLIED` |
| D2 | SMS clicked, mail responded | same | **PR #1082** |
| D3 | Deal won / goal | `journey.weapon_journey.donated_at` | **PR #1082** `DONATED` |
| D4 | Contact property equals / known | `core.donor_profile` (whitelisted columns) | **PR #1082** `HAS_*`, `ATTR_EQUALS` |
| D5 | Preferred channel | e59 crosswalk | **PR #1082** `CHANNEL_PREFERRED` |
| D6 | On suppression list / in blackout / touch cap | `brain.suppression_list` 668, `e10.blackout`, step_log | **PR #1082** `SUPPRESSED`, `IN_BLACKOUT`, `TOUCH_CAP_HIT` |
| D7 | Dark-mode rule | a send E20 never dispatched evaluates FALSE → "No" branch | **PR #1082** by design |

## E. Workflow settings (HubSpot "Settings" tab)
| # | HubSpot | BGOP | Exists live | Lands |
|---|---|---|---|---|
| E1 | Goal criteria + unenroll when met | E41 | none | **PR #1082** `journey_policy.goal_predicate`, `unenroll_on_goal`, `unenroll_siblings` |
| E2 | Suppression lists | E20 / E30 / E31 / E59 | `brain.suppression_list` 668, `e30.suppression_list`, `e31.phone_suppression_list`, `e59….do_not_contact` | **PR #1082** enforced before every weapon tile + `e41.journey_suppression` |
| E3 | Send times / quiet hours | E41 (TCPA floor) | none | **PR #1082** `quiet_hours_start/end`, `allowed_weekdays`, donor-local |
| E4 | Legal/FEC blackout (no native) | E10 | `e10.blackout` (scope_type/value) | **PR #1082** `honor_blackout` → waits on `blackout.cleared` |
| E5 | Max sends per contact | E41 fatigue (LP capstone constraint) | none | **PR #1082** `max_touches_per_day/total` |
| E6 | Workflow on/off | E41 | `e41.control_state` off/on/timer (live) | — |
| E7 | Versioning / edit while running | E41 | `journey_definition.version` | OPEN — positions pin to tile_id, so an in-flight edit must clone the journey; no clone function yet |
| E8 | Permissions (who can publish) | E68 | `wizard_approved_by` | Ed phrase only; staff roles — OPEN |

## F. Reporting
| # | HubSpot | BGOP | Lands |
|---|---|---|---|
| F1 | Enrollment history per contact | E41 | **PR #1082** `e41.v_journey_enrollment_history` |
| F2 | Workflow performance (enrolled/completed/goal) | E41 / E06 | **PR #1082** `e41.v_journey_performance` |
| F3 | Branch-level conversion | E41 / E22 | **PR #1082** `e41.v_journey_branch_performance` |
| F4 | Revenue attribution | E72 / outcome.* | `outcome.weapon_outcome`, `outcome.donation_attribution` (0 rows) | — (exists, empty until cannons fire) |
| F5 | SLO per channel | outcome | `outcome.weapon_slo` W01–W16 all `no_data` | — |

## G. Rulings — resolved 2026-10-02 (Devin evidence memo MATRIX_G_RULINGS_EVIDENCE_2026-10-02, relayed by Ed; each claim re-verified live by Claude)
| # | Ruling | Evidence (live) | Implemented |
|---|---|---|---|
| G1 | **Retire** `EXEC_E16_DIRECT_MAIL` + `EXEC_E18_PHONE_CALL`, don't re-eco | both enabled=false, fire_count 0; re-eco collides with `uq_executor_gun_event`; `brain.observe_log.executor_code` FK (deploy 64 precedent) | `DRYRUN_E20_RETIRE_MISECOED_EXECUTORS_E16_E18_2026-10-02.sql` — aborts on history; rehearsed |
| G2 | "E30 twice" stale (deploy 64 deleted BURST). Real defect: `event_class='donation.received'` | one E30 row, event_class confirmed | `DRYRUN_E30_EXECUTOR_EVENT_CLASS_FIX_2026-10-02.sql` → `outreach.email_ready`; rehearsed |
| G3 | Journey defaults 1/day · 6/journey · 21–08 local = E41 floor; `e10.fatigue_policy` = ceiling | ALL_CHANNELS 3/168h, PER_CHANNEL 2/168h live | `Scheduler._fatigue_ceiling_hit` counts across ALL journeys (step_log ∪ weapon_queue); ceiling breach holds, never exits |
| G4 | SEND_PREFERRED order confirmed; filter at each step; E41 owns resolution; terminal | — | `_resolve_preferred` filters registry·reach·suppression·PER_CHANNEL ceiling per candidate; no survivor → skip_tile + `journey_step_log` row (`suppressed`/`no_eligible_channel`) and continue; exit `no_eligible_channel` only when nothing follows |
| G5 | One `StudioCannonAdapter` keyed by W-code; executor from `e41.weapon_registry`; `/api/v2/actions/execute`; E84 has no execution role | `ops.gate_r4_studio_gate_state` W01–W16 OBSERVE | `e41_studio_cannon_adapter.py` — compose/validate/preview(PREVIEW mode)/request; body carries decision_id, studio_id, executor_code, munition_id, content_hash, audience_snapshot_id; FIRE refused → OBSERVE unless gate=FIRE ∧ executor enabled ∧ Ed-authorized hash matches |

Still pending Ed's phrase: G1 and G2 dry-runs. Everything else is code in the branch.

## G (original). Rulings needed from Ed
1. **C5/C16** — `EXEC_E16_DIRECT_MAIL` and `EXEC_E18_PHONE_CALL` are registered under the wrong ecosystems (W05 mail = E33, W16 phone = E32). Retire, or re-eco them?
2. **C1** — ~~E30 registered twice~~ stale since deploy 64; canonical `EXEC_E30_EMAIL_SEND`, event_class fix is G2.
3. **E5 defaults** — `max_touches_per_day=1`, `max_touches_total=6`, quiet hours 21:00–08:00 local. Confirm or set.
4. **C17 order** — `SEND_PREFERRED` resolves group primary → secondary → tile candidates → fallback. Confirm that precedence.
5. **A4** — studio adapter contract per cannon (E68 GOD FILE "exact adapter contract per ecosystem" is still an open decision there).

## H. Gap rows that remain OPEN after PR #1082 (ranked)
1. Studio adapters (A4/A5) — the frontstage has nothing to call per channel
2. Cross-journey enroll action (C23) and journey clone for edit-while-running (E7)
3. E22 assignment call from a tile (C24)
4. E06 observed send-time peaks for Smart-Send (A8)
5. N-way value branch in the compiler (C21)
