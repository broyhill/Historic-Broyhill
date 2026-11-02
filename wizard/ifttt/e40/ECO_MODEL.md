# E40 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E40 — Automation Control Panel
| Field | Value |
|---|---|
| **Name** | Automation Control Panel (IFTTT-style) |
| **Band** | 03-RevOps |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_40_automation_control_panel_complete.py` |
| **Purpose** | Visual workflow automation builder for non-technical users. Custom trigger-action sequences across all ecosystems. Conditional logic, time delays, branching, multi-step automations. Handles deterministic rules (e.g., "when donor gives $500+, add to VIP list"). Distinct from E20 (Brain) which handles intelligent probabilistic decisions. |
| **Feeds into** | E20 (Brain — automation trigger events), all ecosystems via deterministic rule execution |
| **Fed by** | E00 (event bus — trigger events), Ed/staff (rule configuration) |
| **Open-source stack** | n8n (open-source automation patterns), Redis (rule evaluation) |
| **Surpasses** | Zapier, Make/Integromat, IFTTT, HubSpot Workflows, ActiveCampaign Automations, n8n, Workato |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 8
- ECO_CANONICAL/E40/._ecosystem_40_automation_control_panel_complete.py
- ECO_CANONICAL/E40/1766013160623_ecosystem_40_admin_dashboard 2.html
- ECO_CANONICAL/E40/1766013160623_ecosystem_40_admin_dashboard.html
- ECO_CANONICAL/E40/2026-06-09_brain_triggers_load_e40_catalog.sql
- ECO_CANONICAL/E40/ecosystem_40_admin_dashboard 2.html
- ECO_CANONICAL/E40/ecosystem_40_admin_dashboard.html
- ECO_CANONICAL/E40/ecosystem_40_automation_control_panel.py  ⚠ needs_review
- ECO_CANONICAL/E40/ecosystem_40_automation_control_panel_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] verify completeness against category spec

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
