# E57 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E57 — Messaging Center (Standalone)
| Field | Value |
|---|---|
| **Name** | Messaging Center (Standalone) |
| **Band** | 04-Extensibility |
| **Status** | ✅ Live |
| **Canonical file** | `ecosystems/ecosystem_57_messaging_center_complete.py` |
| **Purpose** | Standalone two-way messaging hub. WhatsApp Business + multi-platform DM coordination. **FOLDED 2026-06-13 into E35 (Conversation & Notification Fabric) — E57 retired; connectors live under E36, threads under E35.** |
| **Feeds into** | E35 (unified inbox — message threads), E20 (Brain — messaging engagement events) |
| **Fed by** | E15 (contact — messaging consent), E36 (messenger — platform routing) |
| **Open-source stack** | WhatsApp Business API, Twilio Conversations |
| **Surpasses** | WhatsApp Business API direct, Twilio Conversations |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 2
- ECO_CANONICAL/E57/ecosystem_57_messaging_center.py  ⚠ needs_review
- ECO_CANONICAL/E57/ecosystem_57_messaging_center_complete.py

## GAPS — fill-in-the-blank
- [ ] sql/schema: no canonical DDL on repo — schema must be captured from live DB or written

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
