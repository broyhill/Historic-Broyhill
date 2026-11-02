# BGOP Engage

**Product:** Native cross-channel engagement app (clone of Iterable-*class* capabilities)  
**Rule:** **We clone. We do not subscribe to Iterable (or any brand ESP/MA we have to rent).**  
**Send gun underneath:** E30 (native SendGrid / SES) — Engage orchestrates; E30 delivers email.  
**Decision authority:** E60 LP stays SoR. Engage supplies coefficients + executes journeys; LP decides ask/channel/budget/fatigue.
<!-- 2026-10-03: pre-canon 'E19 LP' corrected to E60 per PORT_LIST §2. E19 is Social Media. -->  
**E#:** Pending Ed assignment — product ships as `bgop_engage` until numbered.  
**Date:** 2026-07-24 · **Authority:** Ed Broyhill

---

## Why this exists

Iterable is a paid SaaS. BGOP does not wire their product.  
This package is the **ownable app** so Engage can be serviced in one place — not scattered as “Iterable adapter” crumbs under E30.

## What Claude / agents read first

1. This `README.md`  
2. `CLAUDE.md`  
3. `ARCHITECTURE.md`  
4. `docs/ITERABLE_CLONE_MAP.md` (competitive teardown → native modules)  
5. `docs/NO_VENDOR_SUBSCRIBE.md`

## Package layout

```
ecosystems/bgop_engage/
  README.md                 ← you are here
  CLAUDE.md                 ← Claude boot for this app
  ARCHITECTURE.md           ← system map
  MANIFEST.json             ← module registry
  __init__.py
  modules/                  ← native Python modules (no Iterable SDK)
  schema/                   ← SQL for engage.* (also mirrored to database/migrations/)
  docs/                     ← clone map + hard rules
```

## Modules (native)

| Module | Job | Does NOT call |
|---|---|---|
| `profiles` | Engagement profile + attributes | Iterable Users API |
| `propensities` | Affinity / p_engage / channel-time-freq coeffs → LP | Nova SaaS |
| `catalog` | Asks / events / content collections | Iterable Catalog SaaS |
| `journeys` | Tiles: start / message / delay / filter / update | Iterable Journey Studio SaaS |
| `campaigns` | Blast + triggered sends via **E30** | Iterable Email API |
| `data_feed` | Send-time hook → E60 LP decision JSON | Iterable Data Feed SaaS |
| `webhooks` | Engagement events → `brain.event_queue` | Iterable System Webhooks SaaS |

## Schema

Canonical migration (discoverable — **not** under dryrun/):

`database/migrations/062_BGOP_ENGAGE.sql`

Creates `engage.*` tables. Apply on Hetzner only after Ed: **`I AUTHORIZE THIS ACTION`**.

## AUTHORIZATION ASK (Ed)

Ready to apply: `database/migrations/062_BGOP_ENGAGE.sql`  
Effect: creates `engage` schema + profile/journey/campaign/propensity/catalog/event tables; seeds nothing that sends email.  
Does **not**: subscribe to Iterable, open vendor account, or enable live sends.  
Reply with: **`I AUTHORIZE THIS ACTION`**

## Related (do not confuse)

| Path | Meaning |
|---|---|
| `docs/canonical/seamless-research/ITERABLE_*` | Competitive teardown only |
| `ecosystems/e30_email/` | Email **gun** (delivery) |
| ~~IterableProvider / ITERABLE_API_KEY~~ | **Rejected** — subscribe-to-brand path; not this product |
