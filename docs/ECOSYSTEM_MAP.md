# Historic Broyhill — Ecosystem Map (human view)

Hub-and-spoke, one organism. **The app is the hub** — one shared memory
(leads, profiles, scores, timelines, campaigns). Each ecosystem is a **spoke**
bolted onto it: it reads the hub's memory and writes back to it. No spoke
talks to another spoke directly, and nothing stands alone.

## The loop, in plain English

> **Brain decides → Wizard asks Ed → Engage sends → the hub remembers.**

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

3. **Engage / Iterable** — *sends.* The engagement engine: journeys,
   templates, suppression, propensity sync. Vendored at `vendor/bgop-engage/`
   + `vendor/iterable/` (clone map, E30 bridge, Nova teardown, peer design
   draft). Dormant until a channel provider is bound.

4. **The hub itself** — *remembers.* Leads, profiles, scores, timelines,
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
