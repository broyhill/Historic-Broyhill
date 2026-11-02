# E72 Assignment - Campaign Investment Engine

**Date:** 2026-07-01  
**Canonical owner:** E72  
**Source lineage:** Renamed from old `E61_cost_benefit_variance` per 2026-07-01 ecosystem-number ruling.  

## Assignment

E72 now owns the Cost / Benefit / Variance ML Brain Control package:

- Welford online variance
- Bayesian Thompson sampling
- budget optimizer
- attribution resolver
- variance snapshots
- anomaly detector
- E20 brain signal emission
- E40 automation throttles

Current GitHub location:

- `ecosystems/E72_campaign_investment_engine/`
- `database/migrations/004_e72_campaign_investment_engine.sql`

Original rescue commit:

- `22c3a6d4ed6f0fd02f9d141be969f15fb9134df5`

## Critical Namespace Warning

The rescued package still contains old E61 names in code comments, imports, API paths, and SQL schema references. Most importantly, the migration still creates and writes to schema `e61`.

Do not execute `database/migrations/004_e72_campaign_investment_engine.sql` until a namespace cleanup is completed and reviewed. The cleanup must decide whether the live schema is:

- `e72` (recommended for clean separation from E61 SIIRE), or
- a compatibility schema with explicit bridge views and documented ownership.

Until then, E72 is preserved and assigned, but not ready for Hetzner DDL apply.

## Existing E72 Doc Collision

Older GitHub docs under `AGENT_BOOT/ECOSYSTEM FILES/E72/` describe a government grant / donor / sponsor overlap system also named "Campaign Investment Engine." That is a separate legacy E72 design collision.

Do not silently overwrite it. Treat it as unresolved historical architecture until Ed assigns it, folds it, or renumbers it.

## Correct Next Work

1. Rename package references from old `E61_cost_benefit_variance` to `E72_campaign_investment_engine`.
2. Rename search-index metadata from `ecosystem=E61` to `ecosystem=E72`.
3. Rename API paths from `/e61/` to `/e72/` or explicitly document compatibility aliases.
4. Rename SQL schema references away from `e61` before any DDL apply.
5. Run unit tests after import namespace cleanup.
6. Only then prepare a dry-run DDL/report for Ed authorization.
