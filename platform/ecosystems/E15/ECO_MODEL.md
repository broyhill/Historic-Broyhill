# E15 — Parallel Model Ecosystem (read-only source ecos; fill here)

## Live condition (query-proven 2026-07-23)
not audited live yet — run relay information_schema check before build

## VOLUME-X DEFINITION (Nexus original logic, 2026-05-19/06-12)
### E15 — Contact Directory
| Field | Value |
|---|---|
| **Name** | Contact Directory / Contact Management |
| **Band** | 00-Foundation |
| **Status** | ✅ Live |
| **Canonical file** | `backend/python/ecosystems/ecosystem_15_contact_directory_complete.py` |
| **Purpose** | Centralized contact directory above the person spine. Communication preferences, opt-in/opt-out status, contact history, relationship mapping. Every outbound communication checks E15 for deliverability, consent, preferred channel before sending. Enforces TCPA, CAN-SPAM, state contact regulations. |
| **Feeds into** | E30 (email — consent check), E31 (SMS — TCPA consent), E32 (phone — DNC check), E33 (mail — deliverability), E36 (messenger — platform check) |
| **Fed by** | E00 (person spine), E02 (donation contact updates), E25 (donor self-service preference changes) |
| **Open-source stack** | PostgreSQL, Redis (real-time opt-out cache) |
| **Surpasses** | Salesforce CRM, HubSpot CRM, Zoho CRM, Microsoft Dynamics 365, NGP VAN, L2 Political |
| **Brain triggers** | `contact.preference_updated`, `contact.opted_out`, `contact.bounced`, `contact.unsubscribed`, `contact.resubscribed`, `contact.consent_expired`, `contact.duplicate_detected` |

---

## Band 01 — Media Production (E16–E18, E16B)

*Source: AGENT_BOOT/NEXUS-Perplexity Reference Files/BGOP_PLATFORM_PLAN_VOLUME_X_ECOSYSTEM_MAP_COMPLETE_2026-06-12.md*

## Standard slots
- `code/`
- `sql/schema/`
- `sql/dryrun/`
- `taxonomies/`
- `tests/`
- `docs/`

## Canonical files present: 4
- ECO_CANONICAL/E15/._ecosystem_15_contact_directory_complete.py
- ECO_CANONICAL/E15/contact-directory-onboarding.html
- ECO_CANONICAL/E15/ecosystem_15_contact_directory.py  ⚠ needs_review
- ECO_CANONICAL/E15/ecosystem_15_contact_directory_complete.py  ⚠ needs_review

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
