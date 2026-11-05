# E36 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E36 — Messenger Integration
| Field | Value |
|---|---|
| **Name** | Messenger Integration |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_36_messenger_integration_complete.py` |
| **Purpose** | Facebook Messenger, Instagram DM, WhatsApp Business integration. Chatbot flows, live agent routing, engagement metrics. AI-assisted response suggestions at scale. |
| **Feeds into** | E35 (unified inbox — messenger threads), E20 (Brain — messenger engagement events) |
| **Fed by** | E09 (content creation — AI response suggestions), E15 (contact — messenger preference), E20 (Brain — GO decisions) |
| **Open-source stack** | Meta Messenger API, WhatsApp Business API, python-facebook-api |
| **Surpasses** | ManyChat, Chatfuel, MobileMonkey/Customers.ai, Respond.io, MessageBird, Twilio Conversations |

---

## Band 05 — Advanced Automation (E37–E44)

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 8
- ECO_CANONICAL/E36/._ecosystem_36_messenger_integration_complete.py
- ECO_CANONICAL/E36/003_E36_unified_inbox_extension.sql
- ECO_CANONICAL/E36/ecosystem_36_messenger_integration.py  ⚠ needs_review
- ECO_CANONICAL/E36/ecosystem_36_messenger_integration_complete.py  ⚠ needs_review
- ECO_CANONICAL/E36/ecosystem_36_messenger_integration_complete.sql
- ECO_CANONICAL/E36/ECOSYSTEM_36_MESSENGER_INTEGRATION_SCHEMA.sql
- ECO_CANONICAL/E36/meta_ingest.py
- ECO_CANONICAL/E36/triage_engine.py

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
