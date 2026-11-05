# E17 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
e17 live 12 tables, taxonomies seeded, zero operational rows; no vendor

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E17 — Ringless Voicemail
| Field | Value |
|---|---|
| **Name** | Ringless Voicemail (RVM) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_17_rvm_complete.py` |
| **Purpose** | Mass ringless voicemail drop system. Delivers pre-recorded messages directly to voter voicemail without ringing. Carrier compliance, drop scheduling, delivery confirmation, response tracking. Integrates E16B for AI voice drops. TCPA-sensitive — only fires on consented numbers. |
| **Feeds into** | E15 (contact — opt-out tracking), E32 (phone banking — RVM fallback when unanswered) |
| **Fed by** | E16B (voice synthesis), E20 (Brain — targeting decision), E15 (contact consent verification) |
| **Open-source stack** | Drop Cowboy API (primary, $0.004/drop), CallFire API (backup, $0.075/drop) |
| **Surpasses** | Stratics Networks, Drop Cowboy, SlyBroadcast, VoiceLogic, Call Loop |
| **Brain triggers** | `rvm.campaign_scheduled`, `rvm.drop_started`, `rvm.drop_complete`, `rvm.delivery_confirmed`, `rvm.carrier_rejected`, `rvm.response_received`, `rvm.opt_out_requested` |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 5
- ECO_CANONICAL/E17/._ecosystem_17_rvm_complete.py
- ECO_CANONICAL/E17/E17_RVM_SCHEMA_V1_2026-07-07.sql
- ECO_CANONICAL/E17/ecosystem_17_rvm.py  ⚠ needs_review
- ECO_CANONICAL/E17/ecosystem_17_rvm_complete.py  ⚠ needs_review
- ECO_CANONICAL/E17/ecosystem_17_rvm_gateway.py

## GAPS — fill-in-the-blank
- [ ] verify completeness against category spec

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
