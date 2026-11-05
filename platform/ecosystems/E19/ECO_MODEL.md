# E19 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
no schema; Diamond Vault Mac files missing

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E19 — Social Media Manager
| Field | Value |
|---|---|
| **Name** | Social Media Manager (Brain Pentad member) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live — multiple file variants |
| **Canonical file** | `backend/python/ecosystems/ecosystem_19_social_media_manager.py` (canonical) — NOTE: also `ecosystem_19_social_media_enhanced.py`, `ecosystem_19_personalization_engine.py`, and `ecosystem_19_social_media_integration_patch.py` exist as variants/supplements |
| **Purpose** | Multi-platform social media management: Facebook, X, Instagram, LinkedIn, TikTok, Truth Social. Content scheduling, cross-posting, engagement tracking, comment monitoring, audience growth analytics. Brain (E20) can trigger emergency social posts within seconds of a news crisis. Brain Pentad member — receives `GradedDonor` from E01, emits `PersonalizedMessage` to E30. |
| **Feeds into** | E20 (Brain — engagement events), E30 (email — Brain Pentad payload `PersonalizedMessage`), E22 (A/B — social variant testing), E46 (broadcast hub — social live stream) |
| **Fed by** | E01 (donor grade — targeting), E08 (communications library — templates), E09 (content creation — generated posts), E20 (Brain — emergency post triggers), E42 (news intelligence — trending topics) |
| **Open-source stack** | Facebook Graph API, X/Twitter API v2, Instagram Basic Display API, LinkedIn API, TikTok API |
| **Surpasses** | Hootsuite, Sprout Social, Buffer, Later, Sprinklr, Brandwatch, Meltwater |
| **Brain Pentad payload** | Receives: `GradedDonor` (from E01). Emits: `PersonalizedMessage` (to E30). |
| **Brain triggers** | `social.post_scheduled`, `social.post_published`, `social.engagement_spike`, `social.negative_comment`, `social.follower_milestone`, `social.crisis_post_needed`, `social.trending_topic_detected` |
| **Notes** | Multiple files exist for this ecosystem. `ecosystem_19_social_media_manager.py` is canonical. `ecosystem_19_personalization_engine.py`, `ecosystem_19_audience_builder.py`, `ecosystem_19_funnel_sequencer.py`, etc. are sub-components. Do not merge without Ed's explicit direction. |

---

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 44
- ECO_CANONICAL/E19/._ecosystem_19_personalization_engine.py
- ECO_CANONICAL/E19/._ecosystem_19_social_media_enhanced.py
- ECO_CANONICAL/E19/._ecosystem_19_social_media_manager.py
- ECO_CANONICAL/E19/001_E19_social_bio.sql
- ECO_CANONICAL/E19/002_E19_social_dm.sql
- ECO_CANONICAL/E19/005_E19_social_funnel.sql
- ECO_CANONICAL/E19/2026-05-03_e19_social_schema.sql
- ECO_CANONICAL/E19/_e19_contracts.py
- ECO_CANONICAL/E19/bio_page.html
- ECO_CANONICAL/E19/bio_renderer.py
- ECO_CANONICAL/E19/click_attribution_worker.py
- ECO_CANONICAL/E19/e19_integration_schema.sql
- ECO_CANONICAL/E19/e33_integration.py
- ECO_CANONICAL/E19/ecosystem_19_audience_builder.py
- ECO_CANONICAL/E19/ecosystem_19_content_optimizer.py
- ECO_CANONICAL/E19/ecosystem_19_DEPLOY_ALL.sql
- ECO_CANONICAL/E19/ecosystem_19_funnel_sequencer.py
- ECO_CANONICAL/E19/ecosystem_19_listening_inbox.py
- ECO_CANONICAL/E19/ecosystem_19_news_trigger.py
- ECO_CANONICAL/E19/ecosystem_19_personalization_engine.py  ⚠ needs_review
- ECO_CANONICAL/E19/ecosystem_19_social_media.py  ⚠ needs_review
- ECO_CANONICAL/E19/ecosystem_19_social_media_enhanced.py  ⚠ needs_review
- ECO_CANONICAL/E19/ecosystem_19_social_media_integration_patch.py
- ECO_CANONICAL/E19/ecosystem_19_social_media_manager.py  ⚠ needs_review
- ECO_CANONICAL/E19/ECOSYSTEM_19_SOCIAL_MEDIA_SCHEMA 3.sql
- ECO_CANONICAL/E19/geo_ip.py
- ECO_CANONICAL/E19/qr_generator.py
- ECO_CANONICAL/E19/response_router.py
- ECO_CANONICAL/E19/routes.py
- ECO_CANONICAL/E19/test_e19_ai_disclosure.py
- ECO_CANONICAL/E19/test_e19_audience_builder.py
- ECO_CANONICAL/E19/test_e19_compliance_gates.py
- ECO_CANONICAL/E19/test_e19_content_optimizer.py
- ECO_CANONICAL/E19/test_e19_funnel_sequencer.py
- ECO_CANONICAL/E19/test_e19_funnel_stage_gate.py
- ECO_CANONICAL/E19/test_e19_listening_inbox.py
- ECO_CANONICAL/E19/test_e19_match_tier_gate.py
- ECO_CANONICAL/E19/test_e19_meta_24h_window.py
- ECO_CANONICAL/E19/test_e19_news_trigger.py
- ECO_CANONICAL/E19/test_e19_no_fake_accounts.py
- ECO_CANONICAL/E19/test_e19_paid_disclosure.py
- ECO_CANONICAL/E19/test_e19_pentad_contract.py
- ECO_CANONICAL/E19/test_e19_social_media.py
- ECO_CANONICAL/E19/webhook_handler.py

## GAPS — fill-in-the-blank
- [ ] pipeline/service: no schema; Diamond Vault Mac files missing

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
