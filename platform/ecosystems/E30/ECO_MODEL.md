# E30 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
e30 live 12 tables, config only; channel PROHIBITED (Anchor 1)

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E30 — Email Campaigns
| Field | Value |
|---|---|
| **Name** | Email Campaigns (Brain Pentad member) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live — enterprise rewrite May 2026 |
| **Canonical file** | `backend/python/ecosystems/ecosystem_30_email_complete.py` |
| **Purpose** | Full-scale email marketing. List segmentation, dynamic personalization, send-time optimization, bounce handling, deliverability monitoring. Automated drip sequences, event-triggered sends from E20. A/B testing of subject lines. Maintains sender reputation. Brain Pentad member. |
| **Feeds into** | E06 (analytics — open/click events), E11 (budget — send costs), E15 (contact — bounce/unsub updates), E22 (A/B — variant results) |
| **Fed by** | E08 (communications library — templates), E09 (content creation — body copy), E15 (contact — consent verification), E19 (social — Brain Pentad payload `PersonalizedMessage`), E20 (Brain — GO decisions), E41 (campaign builder — sequence steps) |
| **Open-source stack** | SendGrid API, python-sendgrid, DKIM/SPF/DMARC validation |
| **Surpasses** | Mailchimp, Constant Contact, Campaign Monitor, Klaviyo, ActiveCampaign, Pardot/Salesforce Marketing Cloud |
| **Brain Pentad payload** | Receives: `PersonalizedMessage` (from E19). Emits: `SendOutcome` (to E11). |
| **Brain triggers** | `email.campaign_sent`, `email.opened`, `email.clicked`, `email.bounced`, `email.unsubscribed`, `email.spam_complaint`, `email.drip_triggered`, `email.deliverability_warning` |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 29
- ECO_CANONICAL/E30/._ecosystem_30_email_complete.py
- ECO_CANONICAL/E30/._ecosystem_30_email_dual_grading.py
- ECO_CANONICAL/E30/2026-07-05_DRYRUN_E30_ENTERPRISE_EMAIL.sql
- ECO_CANONICAL/E30/323_e30_consent_send_suppression.sql
- ECO_CANONICAL/E30/__init__.py
- ECO_CANONICAL/E30/compliance.py
- ECO_CANONICAL/E30/config.py
- ECO_CANONICAL/E30/contracts.py
- ECO_CANONICAL/E30/deliverability.py
- ECO_CANONICAL/E30/e30-send-worker.py
- ECO_CANONICAL/E30/e30_enterprise_email_sender.py
- ECO_CANONICAL/E30/e30_hetzner_teardown.sql
- ECO_CANONICAL/E30/ecosystem_30_email.py  ⚠ needs_review
- ECO_CANONICAL/E30/ecosystem_30_email_complete.py  ⚠ needs_review
- ECO_CANONICAL/E30/ecosystem_30_email_dual_grading.py  ⚠ needs_review
- ECO_CANONICAL/E30/grading_router.py
- ECO_CANONICAL/E30/ml_loop.py
- ECO_CANONICAL/E30/pipeline.py
- ECO_CANONICAL/E30/providers.py
- ECO_CANONICAL/E30/sender.py
- ECO_CANONICAL/E30/sequences.py
- ECO_CANONICAL/E30/tenant.py
- ECO_CANONICAL/E30/test_e30_canspam.py
- ECO_CANONICAL/E30/test_e30_consent.py
- ECO_CANONICAL/E30/test_e30_fec_disclaimer.py
- ECO_CANONICAL/E30/test_e30_match_tier_gate.py
- ECO_CANONICAL/E30/test_e30_pentad_contract.py
- ECO_CANONICAL/E30/test_e30_suppression.py
- ECO_CANONICAL/E30/tracking.py

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
