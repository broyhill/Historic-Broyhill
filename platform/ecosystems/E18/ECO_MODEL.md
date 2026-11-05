# E18 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E18 — VDP Composition Engine
| Field | Value |
|---|---|
| **Name** | VDP Composition Engine (Variable Data Printing) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live — two canonical files |
| **Canonical file** | `backend/python/ecosystems/ecosystem_18_vdp_composition_engine_complete.py` (primary VDP) + `ecosystem_18_print_advertising_complete.py` (print advertising variant) |
| **Purpose** | Merges donor-specific data fields into direct mail templates. Dynamic image selection, ask-amount laddering from giving history, localized candidate photos/district maps, USPS barcode generation. Feeds press-ready PDFs to E14. |
| **Feeds into** | E14 (print production — press-ready PDFs), E33 (direct mail — campaign coordination) |
| **Fed by** | E01 (donor grade — ask amount laddering), E03 (candidate profile — localized photos), E08 (communications library — base templates) |
| **Open-source stack** | ReportLab, Pillow, python-barcode, Jinja2 |
| **Surpasses** | XMPie (Xerox), FusionPro (Ricoh/MarcomCentral), DirectSmile, EFI Fiery, PrintUI |
| **Notes** | Two files serve different purposes — `vdp_composition_engine` is the data-merge engine; `print_advertising` handles media placement. Do not merge. |

---

## Band 02 — Intelligence & Social (E19–E23)

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 6
- ECO_CANONICAL/E18/._ecosystem_18_print_advertising_complete.py
- ECO_CANONICAL/E18/._ecosystem_18_vdp_composition_engine_complete.py
- ECO_CANONICAL/E18/ecosystem_18_print_advertising.py  ⚠ needs_review
- ECO_CANONICAL/E18/ecosystem_18_print_advertising_complete.py  ⚠ needs_review
- ECO_CANONICAL/E18/ecosystem_18_vdp_composition_engine.py  ⚠ needs_review
- ECO_CANONICAL/E18/ecosystem_18_vdp_composition_engine_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

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
