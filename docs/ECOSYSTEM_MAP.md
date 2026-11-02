# Historic Broyhill — Ecosystem Map (human view)

Hub-and-spoke, one organism. **The app is the hub** — one shared memory
(leads, profiles, scores, timelines, campaigns). Each ecosystem is a **spoke**
bolted onto it: it reads the hub's memory and writes back to it. No spoke
talks to another spoke directly, and nothing stands alone.

## The loop, in plain English

> **Brain decides → Wizard asks Ed → Engage sends — and IFTTT nerves feed events; Dataiku computes the Brain's answers → the hub remembers.**

1. **Brain (E20)** — *decides.* The intelligence daemon: watches events
   (a lead opens, RSVPs, goes quiet, a date approaches), matches them against
   `brain.triggers` rules, and proposes the next action with its expected value.
   Lives in `vendor/e20-brain/` — canonical spec + the Python daemon
   (`brain_worker.py`, `registry_dispatcher.py`) as reference.
   In-app brain-side scoring already lives in `lib/wizard/feeder/nova.ts`
   (propensity/affinity taxonomy) and `lib/lead-score.ts`.

2. **Wizard (the surface)** — *asks and gets permission.* The agency spine:
   approvals, immutable variants, exact-version authorization, kill switch.
   Merged into the app at `lib/wizard/` + `/admin/wizard-console` +
   `/api/wizard/**`. Dispatch fails closed to dry-run until providers bind.
   Original copy kept at `wizard/` for reference.

3. **IFTTT (E91)** — *the nerves.* Watches for events anywhere in the hub
   (a date approaches, a lead goes quiet, a trigger condition flips true) and
   fires rules — event → rule → action — that hand work to the Brain or a
   channel. Vendored at `vendor/e91-ifttt/`: the XSELLNET rule engines
   (e20/e26/e40 trigger engines), ECO_CANONICAL/E91 spec, and the canonical
   rulings. In BroyhillGOP doctrine this is E91 — the empty shelf that gets
   stocked here first.

4. **Dataiku ML (E60)** — *the math muscle.* The optimization engine the
   Brain computes with: LP solves (who to ask, how much, which channel,
   fatigue), propensity models, funnel intelligence, cost ledger. Vendored at
   `vendor/e60-dataiku/` — ECO_CANONICAL/E60 code + specs + tests, the Dataiku
   platform-selection ruling, and the class-analytics requirements doc.

5. **CFO (E72)** — *the money organ.* Budgets, spend caps, the cost ledger,
   and campaign-investment ROI — the spoke that says what a decision costs and
   whether it paid off. Vendored at `vendor/e72-cfo/` — ECO_CANONICAL/E72 spec
   + SQL + the campaign-investment engine (orchestrator, automation, control
   panel) and architecture docs.

6. **Auditor (C/B/V)** — *cost/benefit/variance, standalone.* After anything
   fires, the Auditor reconciles projected vs actual — what we predicted an
   action would cost and return against what it really did — and feeds the
   variance back so the next decision is smarter. Vendored at
   `vendor/cbv-auditor/`: the E60/CBV engine (variance snapshotter, anomaly
   detector, attribution resolver, Bayesian + Welford stats, throttle
   controller), `ax41_reconcile.py`, the reconciliation skill, and the E87
   observe-seam SQL. Standalone by design — it audits every other spoke,
   including the CFO.

7. **Engage / Iterable** — *sends.* The engagement engine: journeys,
   templates, suppression, propensity sync. Vendored at `vendor/bgop-engage/`
   + `vendor/iterable/` (clone map, E30 bridge, Nova teardown, peer design
   draft). Dormant until a channel provider is bound.

8. **The hub itself** — *remembers.* Leads, profiles, scores, timelines,
   photos, campaigns: `app/`, `lib/`, the root Prisma schema. This is the
   shared memory every spoke reads and writes — the reason a new spoke
   plugs in without rewiring the others.

## Anti-fragmentation rules

- A new capability is **one spoke** — it bolts onto the hub and belongs to
  exactly one of decide / ask / send / remember. If it doesn't fit one of
  those, it isn't ready to add.
- `vendor/` is **reference material** (vendor teardowns + BroyhillGOP donor-side
  code being ported). `lib/` + `app/` is **live code**. Nothing runs from
  `vendor/`.
- Dispatch stays fail-closed until Ed binds a provider — vendored ≠ live.
