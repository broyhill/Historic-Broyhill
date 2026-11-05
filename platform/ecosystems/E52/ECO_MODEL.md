# E52 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E52 — Contact Intelligence / Messaging Center
| Field | Value |
|---|---|
| **Name** | Contact Intelligence Engine + Messaging Center |
| **Band** | 03-RevOps |
| **Status** | ✅ Live — two distinct files, different purposes |
| **Canonical file** | `ecosystems/ecosystem_52_contact_intelligence_engine.py` (contact intelligence) + `backend/python/ecosystems/ecosystem_52_messaging_center_complete.py` (messaging center) |
| **Purpose (contact intelligence)** | Advanced contact enrichment. Wealth indicators, political affiliation confidence, social media profiles, household composition, giving capacity estimates. Cross-references voter file, property records, public filings. 360-degree contact view feeding E01 and E21. |
| **Purpose (messaging center)** | Two-way messaging UI. **MESSAGING HALF FOLDED 2026-06-13 into E35 (Conversation & Notification Fabric). E52 = Contact Intelligence only.** |
| **Feeds into** | E01 (donor intelligence — enriched contact data), E21 (ML clustering — enriched features) |
| **Fed by** | E00 (person spine), E15 (contact directory — base records) |
| **Open-source stack** | Apollo.io API, LinkedIn API, property records API |
| **Surpasses** | WealthEngine, DonorSearch, iWave, FullContact, Clearbit, ZoomInfo, People Data Labs, Pipl |
| **Notes** | Two distinct files exist for E52. Do NOT merge. Identify which is in production before editing either. |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 4
- ECO_CANONICAL/E52/._ecosystem_52_messaging_center_complete.py
- ECO_CANONICAL/E52/ecosystem_52_contact_intelligence_engine.py
- ECO_CANONICAL/E52/ecosystem_52_messaging_center.py
- ECO_CANONICAL/E52/ecosystem_52_messaging_center_complete.py

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
