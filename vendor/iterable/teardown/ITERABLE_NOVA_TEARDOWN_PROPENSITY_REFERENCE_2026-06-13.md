# Iterable (Nova) — Engineer Teardown + Canon Reference + LP-Coefficient Wiring

**Status:** CANONICAL reference. Designates **Iterable as BGOP's engagement/decisioning *propensity* reference** (already the E30 email model; this formalizes the AI-suite mapping). **Adopt none — reference only**, per `BGOP_CRM_MARKETING_AUTOMATION_STANDARD_2026-06-13.md` (49891bc2).
**Date:** 2026-06-13 · **Author:** Nexus (E51) · zero-DB.

---

## 1. The one-line relationship (why this doc exists)

**Iterable computes per-donor propensities; your LP is the portfolio optimizer on top.** Iterable answers "best channel/time/frequency *for this person*"; it has **no budget, capacity, FEC, or fatigue constraint**. Your LP takes Iterable-style propensities as **coefficients** and solves the constrained allocation with auditable shadow prices. Iterable = the propensity layer; E60 LP = the decision. Never let Nova Decisioning replace the LP.

---

## 2. Nova / Iterable AI suite (what it produces)

| Feature | What it outputs (per user) | BGOP analog |
|---|---|---|
| **Brand Affinity™** | label `loyal / neutral / at-risk / negative / unscored` — predicts 30-day engagement likelihood; refreshed weekly; **Explainable AI** panel | E01 engagement temperature / intensity |
| **Predictive Goals** | likelihood-to-convert/churn score for a defined goal; **Explainable AI** (which signals drove it); segmentable/exportable | `p_give` propensity |
| **Channel Decisioning / Optimization** | the channel each user is most likely to engage (email/SMS/push) | channel coefficient for LP |
| **Send Time Decisioning / STO** | individualized best send time (6–24h window) | timing axis |
| **Frequency Decisioning / Optimization** | personalized per-user message cap | fatigue cap input |
| **Nova Agent** | agentic: builds campaigns, audits, runs experiments | E68 Wizard / E20 patterns |
| **Journey Assist** | journey from a plain-language prompt | E68 Wizard "describe → built" |
| **Unknown User Activation** | identify/engage high-intent anonymous visitors | **E56 visitor de-anon** |
| **Command Center** | central campaigns/goals/performance view | E68 cockpit pattern |
| **SMS Compliance Toolkit + audit-ready retention** | consent + stored-message audit records | E10 compliance |

Built AI-native ("not retrofitted onto an old campaign system") — the reason its data activates in real time.

---

## 3. API surface (build-grade)

- **Base:** `https://api.iterable.com`. **Auth:** `Api-Key` header (project-scoped server-side key) or JWT-enabled keys + OAuth2. **Rate:** ~30 req/sec default; bulk endpoints up to 1K events/req ([API overview](https://support.iterable.com/hc/en-us/articles/204780579-API-Overview-and-Sample-Payloads), [APIs.io](https://providers.apis.io/providers/iterable/)).
- **Users (where AI outputs live as profile fields):**
  - `GET /api/users/byUserId/{userId}` — returns `dataFields` incl. `itblDS.brandAffinityLabel` (string) and Predictive-Goal scores.
  - `POST /api/users/update` / `POST /api/users/bulkUpdate` — write `dataFields`.
  - `GET /api/users/getFields` — schema of all profile fields.
- **Events:** `POST /api/events/track` (+ bulk), `GET /api/events/byUserId/{userId}`.
- **Export API (batch out → warehouse):** `GET /api/export/data.json` (by `event_type`, incremental by date range), `GET /api/export/userEvents` (all events by user). Async export jobs for data-warehousing ([Data Integration Guide](https://iterable.com/wp-content/uploads/2023/03/Technical_Data_Integration_Guide_2023.pdf)).
- **System Webhooks (real-time out):** POST every engagement event to your endpoint as JSON (`Content-Type: application/json` + optional `Authorization`). The real-time stream.
- **Journey Webhooks (call OUT from a journey):** mid-journey HTTP request to *your* server — `None / Basic / OAuth2` auth, custom headers (`X-Api-Key`), Handlebars to pass user fields. **This is how an Iterable journey calls the Brain/LP.**
- **Data Feeds (call OUT at send time):** at each send, Iterable GETs an external endpoint, embeds user attrs in the URL (`?email={{email}}`), caches ≤1h, expects a JSON object back for personalization. **This is how the LP returns the ask/channel decision at send time.**
- **Smart Ingest:** data-lake/warehouse → Iterable loading.

---

## 4. The LP-coefficient wiring map (the core deliverable)

**Direction 1 — Iterable → BGOP (propensities become LP coefficients):**
```
Iterable AI fields           extract via                   → Hetzner coefficient    → LP role
brandAffinityLabel           GET /users/byUserId | Export   → donor engagement temp  → E01 / objective weight
Predictive Goal score        Export API | segment           → p_give                 → expected-value term
Channel Decisioning          user dataFields                → channel propensity     → channel coefficient
Send Time                    user dataFields                → best-time slot         → timing constraint
Frequency cap                user dataFields                → per-donor cap          → fatigue constraint
all engagement events        System Webhooks → brain.event_queue (real-time)         → continuous re-score
```
Pull nightly via Export API into a `staging.iterable_propensity` table; stream live via System Webhooks into `brain.event_queue`. These join to the donor on `userId = donor_id`.

**Direction 2 — BGOP → Iterable (the Brain stays the decider, Iterable executes):**
- **Data Feed:** Iterable calls `https://bgop/api/lp/decision?donor={{userId}}` at send time → your LP returns `{ask_amount, channel, copy_variant}` JSON → Iterable renders it. The **LP decides; Iterable sends.**
- **Journey Webhook:** a journey step POSTs to `https://bgop/api/brain/event` (OAuth2/`X-Api-Key`) → Brain logs + can branch the journey.

**Net:** Iterable's per-user propensities feed the LP as coefficients; the LP solves the constrained portfolio allocation with shadow prices; the decision flows back to Iterable (or your own guns) for execution. Same pattern as FOME: BG/NBD + logit produce coefficients → LP decides.

---

## 5. Boundary (reference, adopt none)

- **Propensity ≠ optimization.** Nova Decisioning is greedy per-user (no budget/capacity/FEC/portfolio constraint). The **constrained LP with shadow prices stays yours** — the auditable, portfolio-level decision Iterable structurally can't make.
- **Silo:** Iterable is cloud SaaS; raw donor signature stays in Hetzner (candidate RLS). Push only what a send needs.
- **Auditability:** borrow Iterable's **Explainable AI** instinct (it's the one vendor that leans your way) — but your LP's shadow prices are the stronger, counsel-ready version.
- **Borrow patterns:** Brand Affinity labeling (E01), Explainable AI transparency, Unknown User Activation (E56), Journey Assist/Command Center (E68), the Data-Feed/Journey-Webhook "call the Brain at send time" hooks (the cleanest way to keep the Brain authoritative while using a best-in-class sender).

## 6. Build note

If/when Iterable is used as a sending channel, the integration is: **Export API + System Webhooks IN** (propensities → LP coefficients), **Data Feed + Journey Webhook OUT** (LP decision → Iterable render). No donor decisioning delegated to Iterable. Gated on E20 + Ed AUTHORIZE; canary 147/$332,631.30.

---

## 7. Function → Ecosystem Ownership Map (where each Iterable function lives in BGOP)

**There is no "Iterable ecosystem." Its functionality decomposes across the platform.** Its AI brain distributes into E01+E19+E56+E68; its guns are E30/E31/E67; its orchestration is E26/E40; its plumbing is E55/E57→E20; the decision authority it lacks is E19.

### AI / decisioning suite
| Iterable function | Owned in BGOP by |
|---|---|
| Brand Affinity (engagement temp) | **E01** Donor Intelligence (intensity/engagement temp on signature) |
| Predictive Goals (`p_give`) | **E01** + donor-contribution-forecasting (BG/NBD) → feeds **E19** |
| Channel Decisioning | **E19** LP — channel coefficient |
| Send-Time Decisioning | **E19** LP timing axis + **E26** waterfall scheduling |
| Frequency Decisioning | **E19** LP fatigue constraint + ethical-guardrails caps |
| Nova Agent (build/audit/experiment) | **E68** Wizard + **E20** Brain + **E22** A/B |
| Journey Assist (English → journey) | **E68** Campaign Wizard |
| Unknown User Activation | **E56** Visitor Resolution |
| Command Center | **E68** cockpit + **E51** NEXUS dashboard |
| SMS Compliance Toolkit + retention | **E10** Data Governance + ethical-guardrails (TCPA/10DLC) |

### Sending / orchestration (Iterable plugs in here as an execution destination)
| Function | Owned by |
|---|---|
| Email send | **E30** Email Campaigns (Iterable is the E30 reference model) |
| SMS | **E31** |
| Push | **E67** Push Notification |
| Journeys / cascades | **E26** Waterfall Orchestration + **E40** Automation Control |

### API surface (the rented-pipe plumbing)
| Hook | Owned by |
|---|---|
| Export API + System Webhooks **IN** (propensities) | **E57** Vendor Webhook Layer → `brain.event_queue` (**E20/E00**) |
| Data Feed + Journey Webhook **OUT** (LP decides at send time) | **E55** API Gateway → **E19** LP |
| `userId` = candidate-scoped pseudonymous donor ID | donor-centric-architecture / **E64** |

### What Iterable does NOT own
**Constrained portfolio optimization with shadow prices = E19 LP.** Iterable is greedy per-user (no budget/capacity/FEC/fatigue constraint). The moat stays ours — Iterable can never make that decision.

*Nexus E51 · zero-DB · Iterable = propensity reference; LP = decision · adopt none.*
