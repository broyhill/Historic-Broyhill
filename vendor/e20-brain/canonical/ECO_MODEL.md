# E20 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
brain live+heartbeating; weapon_queue 4887 queued/1 delivered — drain missing

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E20 — Intelligence Brain
| Field | Value |
|---|---|
| **Name** | Intelligence Brain (Brain Pentad orchestrator) |
| **Band** | 00-Foundation (orchestrator of all) |
| **Status** | ✅ Live — 905 triggers loaded / ⚠️ Brain Worker daemon NOT RUNNING (platform gap #1) |
| **Canonical file** | `backend/python/ecosystems/ecosystem_20_intelligence_brain_complete.py` |
| **Purpose** | Central nervous system orchestrating all ecosystems through 905 automated triggers. GO/NO-GO decisions in <1 second. Composite score (0-100) based on urgency, relevance, budget, contact fatigue, historical ROI. Score >70 = auto-execute. 50-69 = human review. <50 = suppress. Brain Pentad orchestrator. |
| **Feeds into** | Every execution ecosystem receives GO/NO-GO decisions from E20. Primary outputs: E17 (RVM), E19 (Social), E30 (Email), E31 (SMS), E32 (Phone), E33 (Mail), E45 (Video) |
| **Fed by** | E01 (donor grades), E06 (analytics KPIs), E11 (budget signals), E15 (contact status), E42 (news events), E51 (Nexus — LP re-tunes) |
| **Open-source stack** | Redis Pub/Sub (event bus), PostgreSQL LISTEN/NOTIFY, Celery (trigger processing) |
| **Surpasses** | Salesforce Einstein, Adobe Sensei, Braze, Iterable, Optimove, Blueshift, 6Sense, HubSpot Workflows |
| **Brain Pentad** | Receives payloads from all Pentad members. Central router. |
| **Brain triggers** | `brain.event_received`, `brain.decision_go`, `brain.decision_nogo`, `brain.decision_review`, `brain.fatigue_block`, `brain.budget_block`, `brain.learning_update`, `brain.anomaly_detected`, `brain.override_requested`, `brain.cascade_triggered` |
| **CRITICAL GAP** | Brain Worker daemon is NOT RUNNING. 905 triggers are loaded but nothing fires. `brain.*` schema is empty (0 rows). E61 (Dark Donor Engine) and E63 (HEATMAP calibration) are both blocked on this. Starting the daemon is the highest-leverage infrastructure fix on the platform. |
| **Canonical docs** | `E20_Brain_Canonical_Reference.md` — to be written (authorized by Ed May 19, 2026) |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 7
- ECO_CANONICAL/E20/._E20_volunteer_integration_update.py
- ECO_CANONICAL/E20/._ecosystem_20_intelligence_brain_complete.py
- ECO_CANONICAL/E20/E20_BRAIN_CENTRIC_ARCHITECTURE.py
- ECO_CANONICAL/E20/E20_volunteer_integration_update.py
- ECO_CANONICAL/E20/ecosystem_20_intelligence_brain.py  ⚠ needs_review
- ECO_CANONICAL/E20/ecosystem_20_intelligence_brain_complete.py  ⚠ needs_review
- ECO_CANONICAL/E20/ecosystem_20_intelligence_brain_v2.py

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written
- [x] founding CRM sync fabric **referenced, not installed** — `007_BRAIN_CRM_POINTER.md` (2026-08-31). Read copy `database/schemas/007_brain_crm.sql`. Cannot enter `sql/` until wrapped to the six-gate standard; first fix is schema-qualification (`brain_control.<table>`, not `SET search_path`). No consumer yet. Do not dry-run.
- [ ] pipeline/service: brain live+heartbeating; weapon_queue 4887 queued/1 delivered — drain missing

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** COST CENTER — judged on cost against a service standard, never revenue.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
