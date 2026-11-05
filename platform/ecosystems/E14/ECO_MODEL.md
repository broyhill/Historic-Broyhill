# E14 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E14 — Print Production
| Field | Value |
|---|---|
| **Name** | Print Production |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_14_print_production_complete.py` |
| **Purpose** | Variable Data Printing pipeline. Template design → press-ready PDF → print vendor submission → USPS delivery tracking. Personalized direct mail with dynamic images, donor-specific ask amounts, localized candidate messaging. Integrates with E18 (VDP composition) and E33 (mail coordination). |
| **Feeds into** | E33 (direct mail — production handoff) |
| **Fed by** | E18 (VDP composition — press-ready PDFs), E33 (campaign-level mail coordination) |
| **Open-source stack** | ReportLab (PDF generation), Pillow (image processing), USPS APIs |
| **Surpasses** | Lob, PostGrid, Inkit, Click2Mail, EasyPost, Postalytics |
| **Brain triggers** | `print.job_submitted`, `print.proof_ready`, `print.vendor_confirmed`, `print.in_production`, `print.shipped`, `print.delivered`, `print.delivery_failed` |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 6
- ECO_CANONICAL/E14/._ecosystem_14_print_production_complete.py
- ECO_CANONICAL/E14/400_e14_lettrlabs_print_job_log.sql
- ECO_CANONICAL/E14/401_e14_lettrlabs_brain_triggers.sql
- ECO_CANONICAL/E14/402_e14_vendor_registry.sql  ⚠ needs_review
- ECO_CANONICAL/E14/ecosystem_14_print_production.py  ⚠ needs_review
- ECO_CANONICAL/E14/ecosystem_14_print_production_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] verify completeness against category spec

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** SUPPORT/SERVICE CENTER (ALLOCATED) — cost allocated to the fires it informs.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
