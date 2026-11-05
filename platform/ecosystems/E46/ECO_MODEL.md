# E46 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E46 — Broadcast Hub
| Field | Value |
|---|---|
| **Name** | Broadcast Hub (Multi-Platform Live Streaming) |
| **Band** | 02-Engagement |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_46_broadcast_hub_complete.py` |
| **Purpose** | Multi-platform live streaming simulcast to Facebook Live, YouTube, Rumble, LinkedIn Live, X Spaces. 50155 shortcode text capture during broadcasts (text EDDIE to donate, VOLUNTEER to sign up). Live QR code donation overlays, real-time engagement tracking, automated post-broadcast clip generation. |
| **Feeds into** | E20 (Brain — broadcast engagement events), E31 (SMS — shortcode responses), E02 (donation — QR code donations) |
| **Fed by** | E45 (video studio — live feed), E20 (Brain — broadcast scheduling) |
| **Open-source stack** | OBS (broadcasting), RTMP protocol, FFmpeg, WebRTC |
| **Surpasses** | Restream, StreamYard, OBS Studio, Switcher Studio, Be.Live, Castr, Vimeo Livestream, BoxCast |

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
- ECO_CANONICAL/E46/._ecosystem_46_broadcast_hub_complete.py
- ECO_CANONICAL/E46/ecosystem_46_broadcast_hub.py  ⚠ needs_review
- ECO_CANONICAL/E46/ecosystem_46_broadcast_hub_complete.py  ⚠ needs_review

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
