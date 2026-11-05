# E31 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
e31 live 12 tables, zero messages; provider integration missing

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E31 — SMS Marketing
| Field | Value |
|---|---|
| **Name** | SMS / RCS / WhatsApp Omnichannel |
| **Band** | 02-Engagement |
| **Status** | ✅ Live — enhanced version available |
| **Canonical file** | `backend/python/ecosystems/ecosystem_31_sms_complete.py` (primary) + `ecosystem_31_sms_enhanced.py` (supplementary) |
| **Purpose** | Text message marketing. TCPA consent tracking, opt-in/opt-out workflows, keyword responses, shortcode campaigns. Broadcast blasts + conversational two-way SMS. Highest-urgency channel for GOTV reminders and crisis alerts. |
| **Feeds into** | E06 (analytics — SMS engagement), E15 (contact — opt-out tracking), E20 (Brain — reply events) |
| **Fed by** | E08 (templates), E15 (contact — TCPA consent verification), E20 (Brain — GO decisions), E41 (campaign builder — sequence steps) |
| **Open-source stack** | Twilio SMS API, python-twilio |
| **Surpasses** | Twilio, Hustle, RumbleUp, Tatango, Community, Attentive, Postscript, SlickText |
| **Brain triggers** | `sms.campaign_sent`, `sms.delivered`, `sms.replied`, `sms.opted_out`, `sms.keyword_received`, `sms.delivery_failed`, `sms.consent_expired` |
| **Notes** | TCPA compliance is non-negotiable. Do not modify consent tracking logic without reading `ethical-guardrails` skill. |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 28
- ECO_CANONICAL/E31/._ecosystem_31_sms_complete.py
- ECO_CANONICAL/E31/._ecosystem_31_sms_enhanced.py
- ECO_CANONICAL/E31/201_e31_sms_enterprise_schema.sql  ⚠ needs_review
- ECO_CANONICAL/E31/2026-07-05_DRYRUN_E31_SMS_MMS_ENTERPRISE.sql
- ECO_CANONICAL/E31/__init__.py
- ECO_CANONICAL/E31/ab_testing.py
- ECO_CANONICAL/E31/ai_composer.py
- ECO_CANONICAL/E31/ai_journeys.py
- ECO_CANONICAL/E31/analytics.py
- ECO_CANONICAL/E31/campaigns.py
- ECO_CANONICAL/E31/config.py
- ECO_CANONICAL/E31/consent.py
- ECO_CANONICAL/E31/conversations.py
- ECO_CANONICAL/E31/cost_ledger.py
- ECO_CANONICAL/E31/drip_sequences.py
- ECO_CANONICAL/E31/e31_twilio_webhook.py
- ECO_CANONICAL/E31/ecosystem_31_sms.py  ⚠ needs_review
- ECO_CANONICAL/E31/ecosystem_31_sms_complete.py  ⚠ needs_review
- ECO_CANONICAL/E31/ecosystem_31_sms_enhanced.py  ⚠ needs_review
- ECO_CANONICAL/E31/entities.py
- ECO_CANONICAL/E31/number_pool.py
- ECO_CANONICAL/E31/phone_registry.py
- ECO_CANONICAL/E31/providers.py
- ECO_CANONICAL/E31/send_engine.py
- ECO_CANONICAL/E31/shortlinks.py
- ECO_CANONICAL/E31/test_e31_consent.py
- ECO_CANONICAL/E31/test_e31_shortlink.py
- ECO_CANONICAL/E31/webhooks.py

## GAPS — fill-in-the-blank
- [ ] pipeline/service: e31 live 12 tables, zero messages; provider integration missing

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
