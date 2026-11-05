# E29 NOTE — 2026-08-16 full ecosystem audit

**Identity:** Analytics Dashboard
**Wiki page present:** no
**Author:** Claude (E84 Owner)  
**Date:** 2026-08-16 13:20 EDT  
**Method:** Read-only three-lens sweep. No Postgres reads, no writes.  
**Full audit:** [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)

## Lens metrics

| Lens | Metric | Value |
|---|---|---:|
| Graphify AST | Nodes | 1,611 |
| Graphify AST | Top path prefixes | ECO_CANONICAL(1), ecosystems(1), AGENT_BOOT(1) |
| Graphify AST | Top cross-eco edges (out) | — |
| E84 catalog | Primary docs | 16 |
| E84 catalog | Any-mention docs | 138 |
| E84 catalog | Authority: orphan | 8 |
| E84 catalog | Authority: recovered | 2 |
| E84 catalog | Authority: doc | 6 |
| E84 catalog | Authority: spec | 0 |
| E84 catalog | Authority: test | 0 |
| E84 catalog | File types (py/md/sql) | 4/11/0 |
| E84 catalog | Deployed slice files | 1 |
| E84 catalog | Orphan slice files | 8 |
| E84 catalog | Spec files recognized | 1 |
| DB coupling | Objects written | 0 |
| DB coupling | Objects read | 0 |
| DB coupling | Handoffs (source→other) | 0 |
| DB coupling | Handoffs (other→target) | 0 |
| DB coupling | Contention objects | 0 |

## Health flags

- **HEAVY-ORPHAN** — >40 % of primary docs sit under `NONDEPLOYED_ORPHANS/` or carry `orphan` authority. Canon-vs-orphan separation exists but orphan pile dominates.
- **NEEDS-WIKI** — Missing wiki page (below NO-WIKI threshold but still has meaningful presence in one or more lenses).

## Related

- Full audit: [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)
- Companion earlier scan: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)
- Aug 9 forensic: [`docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md`](../../docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md)

— Claude (E84 Owner), 2026-08-16 13:20 EDT