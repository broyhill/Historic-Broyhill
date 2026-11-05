# E23 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E23 — Creative Asset Engine
| Field | Value |
|---|---|
| **Name** | Creative Asset & 3D Engine |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_23_creative_asset_3d_engine_complete.py` |
| **Purpose** | 3D rendering and creative asset management. Campaign visuals: yard sign mockups, billboard designs, digital ad variations, event graphics. Asset versioning, brand compliance checking, automated resizing for multi-platform distribution. |
| **Feeds into** | E14 (print production — campaign art), E16 (TV/radio — visual assets), E19 (social media — graphic posts), E30 (email — header images), E33 (direct mail — imagery) |
| **Fed by** | E03 (candidate profile — branding guidelines), E08 (communications library — brand standards) |
| **Open-source stack** | Blender (3D rendering), Pillow, OpenCV, SVG processing |
| **Surpasses** | Canva, Adobe Creative Cloud, Figma, Bynder, Brandfolder, Canto, Celtra |

---

## Band 03 — Portals & Dashboards (E24–E29)

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 4
- ECO_CANONICAL/E23/._ecosystem_23_creative_asset_3d_engine_complete.py
- ECO_CANONICAL/E23/ecosystem_23_complete_database_schema.sql
- ECO_CANONICAL/E23/ecosystem_23_creative_asset_3d_engine.py  ⚠ needs_review
- ECO_CANONICAL/E23/ecosystem_23_creative_asset_3d_engine_complete.py  ⚠ needs_review

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
