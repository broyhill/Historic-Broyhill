# Iterable — Complete Capability + API Inventory ("all the guts")

**Status:** CANONICAL reference appendix to `ITERABLE_NOVA_TEARDOWN_PROPENSITY_REFERENCE_2026-06-13.md` (ae7bfc53). Full feature surface mined from Iterable's help center, mapped to BGOP. **Reference only — adopt none.**
**Date:** 2026-06-13 · Nexus (E51) · zero-DB.

---

## 1. Full doc taxonomy (11 categories)

Setup & Administration · Audience & Data Management · Templates & Campaigns · Personalization & Dynamic Content · Sending by Channel · Journeys · Monitoring Engagement · Iterable AI & Experimentation · Webhooks & Integrations · Developer & API · Release Notes.

---

## 2. Channels (8) — `Sending by Channel`

Email · SMS · Push (iOS/Android) · In-App · Web Push · In-Browser · **Embedded Messaging** (in-product content slots) · Roku. → BGOP guns: E30 email, E31 SMS, E67 push; Embedded/In-App = new in-product surfaces if BGOP ships donor/candidate apps.

## 3. Templates, content & personalization

| Iterable | What it is | BGOP analog |
|---|---|---|
| **Templates** | Per-channel message templates | E08 comms library |
| **Snippets** | Modular reusable content blocks that adapt to user behavior/predictive scores | E08/E09 reusable blocks |
| **Handlebars** | Templating language — inject user fields (`{{itblDS.brandAffinityLabel}}`) | personalization tokens |
| **Data Feeds** | At send time, GET an external endpoint (embed `?email={{email}}`), cache ≤1h, return JSON | **the hook that calls your LP at send time** |
| **Catalog (Catalogs + Collections)** | No-code recommendation engine: store non-user data (events/asks/content) as *catalogs*; build rule-based *collections* that match items to each user; reference via Handlebars | **the "which ask / which event to recommend" surface** — donor → matched ask/event; pairs with E59/LP outputs |

## 4. Journeys (= your E41 waterfall designer)

- **Studio** visual builder. **6 Tile types:** Start · Message · Delay · Filter (branch on attributes/behavior) · User Update (write back to profile/subscriptions) · Integration (call external apps). **Tilesets** = reusable saved tile groups (waterfall templates). **Notes** = internal collaboration.
- **4 Entry sources:** **Event occurs** · **Schedule** (periodic from a list) · **API call** (`POST /api/workflows/triggerWorkflow`) · **Other journey** (chain journeys).
- → This is the journey building-block system to mirror in E41/E73. **Entry sources map to your trigger spine** (Event = Dataverse-trigger/LISTEN-NOTIFY analog; API call = custom-trigger/webhook analog) — same three trigger types as the D365 wiring doc.

## 5. Audience & data

Data Schema Management · Users & User Profiles · Lists & Subscriptions (consent) · Events · **Segmentation** (real-time, dynamic, dozens of criteria incl. affinity/churn-score — auto-updates membership) · Catalog. → E59 microsegments + E10 consent.

## 6. Iterable AI & Experimentation (Nova) — the propensity layer

| Feature | Output | BGOP role |
|---|---|---|
| **Brand Affinity™** | engagement label (loyal/at-risk/…), +Explainable AI | E01 temperature |
| **Predictive Goals** | likelihood-to-convert/churn, +Explainable AI, segmentable | `p_give` |
| **Next Best Action** | picks the highest-impact next step/message per user; retargets good candidates with a fresh version of a prior campaign | waterfall re-rank / LP re-engage |
| **Optimization** | Send-Time · Frequency · Channel | LP coefficients + fatigue cap |
| **AI Assist / Copy Assist** | generate/enhance copy variants | E09/E48 content |
| **Journey Assist** | journey from plain-language prompt | E68 Wizard "describe → built" |
| **Experiments / A-B** | multivariate testing | E22 |
| **Nova Agent** | agentic build/audit/experiment/personalize | E20/E68 patterns |

## 7. Data in/out + developer surface

- **Smart Ingest** — flexible ingestion from CRM/CDP/analytics/commerce → Iterable (clean, marketer-ready). In BGOP, Hetzner is source → push to Iterable via Smart Ingest/API.
- **REST API** (`api.iterable.com`, `Api-Key`/JWT/OAuth2, ~30 req/sec, bulk ≤1K): `/api/users/*` (update, bulkUpdate, byUserId, getFields, merge, updateSubscriptions), `/api/events/track` (+bulk, byUserId), `/api/export/data.json` (incremental by event_type) + `/api/export/userEvents`, **`/api/workflows/triggerWorkflow`** (start a journey via API).
- **System Webhooks** — real-time engagement events POST out (→ `brain.event_queue`).
- **Journey Webhooks** — mid-journey call OUT to your server (None/Basic/OAuth2, custom headers) → **call the Brain/LP**.
- **SDKs** — Web, React Native, iOS/Android, Roku, "Without the SDK"; **Embedded Messaging** SDK.

## 8. Ops layers

Monitoring/Analytics/Reporting + Engagement Metrics · Deliverability (incl. SMS Compliance Toolkit, audit-ready retention) · Setup/Auth/Projects (project = a tenant boundary).

---

## 9. The guts worth taking (synthesis)

1. **Journey Tiles + 4 entry sources + Tilesets** → the E41 waterfall designer blueprint; entry sources = your 3-type trigger spine; Tilesets = reusable waterfall templates.
2. **Catalog (Catalogs + Collections)** → a clean "recommend the right ask/event to each donor" surface — store asks/events, rule-match to donors, render via tokens. Pair with E59/LP outputs.
3. **Data Feed + Journey Webhook + `triggerWorkflow`** → the three hooks that let your **Brain/LP stay authoritative while Iterable executes**: LP returns the decision at send time (Data Feed), journeys call the Brain (Journey Webhook), the Brain starts journeys (triggerWorkflow).
4. **Nova propensities (Affinity/Predictive/Optimization) + Explainable AI** → LP coefficients; borrow the explainability instinct (your shadow prices are the stronger version).
5. **Smart Ingest + Export API + System Webhooks** → the two-way data pipe (Hetzner ⇄ Iterable).

## 10. Boundary (unchanged)

Iterable = **per-user propensity + execution** reference. The **constrained portfolio decision (budget/capacity/FEC/fatigue + shadow prices) stays in your LP.** Donor signature stays in Hetzner under RLS. Project = tenant boundary, but it's no substitute for your candidate-RLS silos. **Adopt none; borrow patterns; gate on E20 + Ed AUTHORIZE.**

---

## 11. Integration networking & security (Hetzner setup — when authorized)

**Region = USDC** (US political data): use `api.iterable.com` + the USDC `ip-ranges.json`. Lock region before any config.

| Direction | Allow by | What | Where |
|---|---|---|---|
| Iterable → Hetzner (Journey/System webhooks, Data Feeds) | **IP range** | USDC `ip-ranges.json` (`webhooks` + `datafeeds` labels; `prefixes_ipv4`/`prefixes_ipv6`) | Hetzner firewall, inbound to receiver endpoints |
| Hetzner → Iterable (Export API, `triggerWorkflow`) | **domain** | `api.iterable.com`; link tracking `links.iterable.com` | egress allow |
| Smart Ingest / Data Sync | feature-specific IPs | separate published lists | as needed |

**Rules:**
1. **Hourly `ip-ranges.json` cron** — pull + reconcile the firewall allowlist every hour. The list rotates (keeps 3 reserve IPs; full rotation possible within 5 min in disaster recovery). A stale allowlist = **silently dropped LP send-time decisions**.
2. **Auth on every inbound webhook** — OAuth2 or `X-Api-Key` header on `bgop/api/lp/decision` (Data Feed) and `bgop/api/brain/event` (Journey Webhook). Per Iterable's own guidance, **never trust IP or user-agent alone**.
3. **Defense in depth (post-April-17):** the receiver is a NEW inbound surface on the previously-compromised box → IP allowlist (outer fence) + request auth (lock) + rate limit + logging. Per `hetzner-server-safety` + `incident-response`.
4. **Apply CIDRs exactly as published** (`prefixes_ipv4` / `prefixes_ipv6`).
5. **Failure mode to monitor:** misconfig surfaces as "Iterable isn't personalizing" with NO error (decisions just don't arrive) — alert on receiver hit-rate, not just errors.

Gated on E20 + Ed `AUTHORIZE`; Cursor executes Hetzner firewall + cron; canary 147/$332,631.30.

---

## 12. Identity model & project structure (DECISION)

**Project type = userId-based.** (Chosen at project creation, **immutable** — there is no way to change it later. Get it right once.)

Why userId-based for BGOP:
- Hetzner (`donor_id`) is the system of record, **not email** → key on your own ID, clean join.
- **Donors share emails** (spouses/households) and have multiple addresses — userId-based supports "multiple users, same email"; email-based structurally cannot. Matches donor reality.
- Supports **anonymous tracking** (pairs with E56 before identity is resolved).
- Keeps **email (PII) out of the API key**; GDPR/CCPA "forget" by `userId`.
- (Email-based is legacy/limited and USDC-only-pre-2024 anyway.)

**The `userId` value = a candidate-scoped PSEUDONYMOUS donor ID** (per `donor-centric-architecture`):
- NOT the raw `donor_id`, NOT PII (no name/email/phone/DOB), NOT sequential/guessable.
- A UUID or salted hash that maps back to `donor_id` **only inside Hetzner** (a `staging.iterable_userid_map` table).
- Satisfies Iterable's userId best practices (static, not guessable, meaningless out of context) AND preserves candidate silos in one move.

**Project = the tenant boundary → one Iterable project per candidate** for hard isolation. Iterable has **no row-level security**, so a *shared* project would let Candidate A's staff see Candidate B's users. Per-candidate projects + per-candidate API keys = silo-safe, consistent with the candidate-RLS doctrine. (Operationally heavier at 3,000 scale; if a shared project is ever forced for cost, isolation must be enforced entirely in BGOP app logic — weaker, not preferred.)

**Guardrail:** Iterable's `userId` is **editable / not permanent** → Hetzner stays the immutable truth; the Iterable userId is a **mirror key, never authoritative** (same rule as D365). Region = USDC. Gated on E20 + Ed `AUTHORIZE`.

---

## 13. Project settings — BGOP configuration (per-candidate project)

All settings below are **per-project** → per candidate. This is a second hard reason for **one project per candidate** (§12): a shared project cannot carry 3,000 different committee CAN-SPAM addresses, logos, sending domains, and unsubscribe footers.

| Setting | BGOP config | Why |
|---|---|---|
| Unique identifier | **userId-based** (§12) | Hetzner is truth; donors share emails |
| **HMAC secret** | **SET** (HMACSHA1) | Iterable cryptographically signs Data-Feed/webhook requests to Hetzner — stronger than IP allowlist alone; pairs with §11 auth |
| Time zone | **America/New_York** | Sending + frequency-cap reset use project TZ. NOTE: data captured in UTC; billing fixed to PT (immutable) |
| Physical mailing address | candidate **committee** address | CAN-SPAM `{{physicalAddress}}` — per-candidate |
| Auto-append unsubscribe block | **ON** (marketing) | CAN-SPAM (`{{unsubscribeUrl}}` + `{{physicalAddress}}`) |
| Hosted unsubscribe URL | **BGOP preference center (E25)** + one-click List-Unsubscribe (POST) | Consent/opt-out lives in **Hetzner as truth**, not stranded in Iterable |
| SMS opt-out instructions | STOP text, per cadence | TCPA / 10DLC (E10/ethical-guardrails) |
| Custom sending domain / DNS / Senders | BGOP own domain + SPF/DKIM/DMARC | Deliverability (11x pattern); decide own-ESP vs Iterable SES shared IPs |
| **Overwrite IP / location fields** | **OFF** | Hetzner + E56 own identity/location — do NOT let Iterable's 3rd-party geolocation overwrite authoritative donor data |
| Locales | enable (e.g. Spanish) as needed | NC multilingual outreach |
| Logo / Name | per candidate | per-candidate branding on subscription pages |

**Net:** HMAC + IP allowlist + request auth = three-layer authentication on the Hetzner receiver (defense in depth, post-April-17). Consent and identity stay authoritative in Hetzner; Iterable carries only per-send + per-candidate config. Gated on E20 + Ed `AUTHORIZE`.

*Nexus E51 · zero-DB · Iterable guts inventory + networking/security + identity model + project config · reference only.*
