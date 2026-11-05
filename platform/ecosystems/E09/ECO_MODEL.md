# E09 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E09 — Content Creation AI
| Field | Value |
|---|---|
| **Name** | Content Creation AI |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_09_content_creation_ai_complete.py` |
| **Purpose** | AI content generation engine producing 30+ content types: fundraising appeals, press releases, social posts, event invitations, thank-you letters, policy briefs. Routes through E13 (AI Hub) to Claude or GPT. Applies candidate's Communication DNA (E48) to every generated piece. |
| **Feeds into** | E08 (generated content → library), E30 (email body generation), E31 (SMS copy), E47 (script variants), E48 (DNA-calibrated output) |
| **Fed by** | E07 (issue positions), E13 (AI Hub — model routing), E48 (communication DNA profile) |
| **Open-source stack** | Anthropic Claude API, OpenAI GPT API, LangChain |
| **Surpasses** | Jasper AI, Copy.ai, Writer.com, Persado, Phrasee, Anyword |
| **Brain triggers** | `content.generation_requested`, `content.generation_complete`, `content.approved`, `content.rejected`, `content.revision_requested`, `content.cost_threshold_warning` |

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
- ECO_CANONICAL/E09/._ecosystem_09_content_creation_ai_complete.py
- ECO_CANONICAL/E09/ecosystem_09_content_creation_ai.py  ⚠ needs_review
- ECO_CANONICAL/E09/ecosystem_09_content_creation_ai_complete.py  ⚠ needs_review

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
