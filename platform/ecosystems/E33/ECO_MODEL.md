# E33 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
no schema found; 5 code copies incl 154B stub — reconcile versions

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E33 — Direct Mail
| Field | Value |
|---|---|
| **Name** | Direct Mail |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_33_direct_mail_complete.py` |
| **Purpose** | Campaign-level direct mail coordination. List selection, piece design, postal optimization, delivery tracking. Every Door Direct Mail (EDDM) for saturation campaigns. Trigger-based pieces (new-donor welcome packs). Coordinates with E14 (print) and E18 (VDP). |
| **Feeds into** | E06 (analytics — mail response tracking), E14 (print production — job submission) |
| **Fed by** | E01 (donor grade — list selection), E14 (print production — tracking), E18 (VDP — personalized pieces), E20 (Brain — GO decisions) |
| **Open-source stack** | Lob API, USPS Informed Delivery API |
| **Surpasses** | Lob, PostGrid, Postalytics, Click2Mail, USPS Informed Delivery, Inkit |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 3
- ECO_CANONICAL/E33/._ecosystem_33_direct_mail_complete.py
- ECO_CANONICAL/E33/ecosystem_33_direct_mail.py  ⚠ needs_review
- ECO_CANONICAL/E33/ecosystem_33_direct_mail_complete.py  ⚠ needs_review

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

*Rule: existing ecosystem lanes are READ-ONLY. All new/filled code lands here until Ed approves promotion.*

## LP CAPSTONE (Ed canon 2026-08-28)
**Ledger class (Ed order 2026-08-28):** REVENUE CENTER — judged on dollars raised at the point of fire.
The entire platform is one giant linear program: MAXIMIZE donations per
candidate at best C/B/V (cost/benefit/variance — most net raised per dollar,
at predictable variance), subject to budget, law, consent, fatigue, and
shared-donor constraints. Every algorithm written in this ecosystem must trace its objective
back to that expression — no local objectives, no self-invented math (E60 hub
selects spoke algorithms). Role taxonomy (coefficient producer / constraint
enforcer / solver / executor) and the binding alignment rules:
docs/canonical/PLATFORM_LP_CAPSTONE_DOCTRINE_2026-08-28.md.
