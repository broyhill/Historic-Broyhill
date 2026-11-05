# E41 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E41 — Campaign Builder
| Field | Value |
|---|---|
| **Name** | Campaign Builder (Multi-Channel Sequence Designer) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_41_campaign_builder_complete.py` |
| **Purpose** | Visual drag-and-drop campaign workflow designer. Multi-step, multi-channel sequences: email drips, SMS touches, phone calls, direct mail, social posts with branching logic based on recipient behavior. Integrates E20 for intelligent timing and E22 for automatic variant testing at each step. |
| **Feeds into** | E30 (email — sequence steps), E31 (SMS — sequence steps), E32 (phone — sequence steps), E33 (mail — sequence steps) |
| **Fed by** | E01 (donor grade — segment selection), E08 (templates — step content), E20 (Brain — timing optimization), E22 (A/B — step variants) |
| **Open-source stack** | PostgreSQL (sequence state machine), Redis (step scheduling) |
| **Surpasses** | Mailchimp Journeys, HubSpot Sequences, ActiveCampaign, Drip, Customer.io, Braze, Iterable, Klaviyo Flows |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 7
- ECO_CANONICAL/E41/._ecosystem_41_campaign_builder_complete.py
- ECO_CANONICAL/E41/1766013160624_ecosystem_41_campaign_builder_ui 2.html
- ECO_CANONICAL/E41/1766013160624_ecosystem_41_campaign_builder_ui.html
- ECO_CANONICAL/E41/ecosystem_41_campaign_builder.py  ⚠ needs_review
- ECO_CANONICAL/E41/ecosystem_41_campaign_builder_complete.py  ⚠ needs_review
- ECO_CANONICAL/E41/ecosystem_41_campaign_builder_ui 2.html
- ECO_CANONICAL/E41/ecosystem_41_campaign_builder_ui.html

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
