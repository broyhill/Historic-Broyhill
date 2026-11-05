# E31 NOTE — 2026-08-16 full ecosystem audit

**Identity:** Messaging Call Center — SMS/MMS/RVM/Live-Call (WIKI)
**Wiki page present:** yes
**Author:** Claude (E84 Owner)  
**Date:** 2026-08-16 13:20 EDT  
**Method:** Read-only three-lens sweep. No Postgres reads, no writes.  
**Full audit:** [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)

## Lens metrics

| Lens | Metric | Value |
|---|---|---:|
| Graphify AST | Nodes | 5,838 |
| Graphify AST | Top path prefixes | api(1), database(1), ECO_CANONICAL(1) |
| Graphify AST | Top cross-eco edges (out) | →E60:23, →E22:16 |
| E84 catalog | Primary docs | 99 |
| E84 catalog | Any-mention docs | 569 |
| E84 catalog | Authority: orphan | 55 |
| E84 catalog | Authority: recovered | 5 |
| E84 catalog | Authority: doc | 33 |
| E84 catalog | Authority: spec | 2 |
| E84 catalog | Authority: test | 2 |
| E84 catalog | File types (py/md/sql) | 30/60/5 |
| E84 catalog | Deployed slice files | 2 |
| E84 catalog | Orphan slice files | 59 |
| E84 catalog | Spec files recognized | 2 |
| DB coupling | Objects written | 18 |
| DB coupling | Objects read | 1 |
| DB coupling | Handoffs (source→other) | 0 |
| DB coupling | Handoffs (other→target) | 0 |
| DB coupling | Contention objects | 1 |

## Health flags

- **HEAVY-ORPHAN** — >40 % of primary docs sit under `NONDEPLOYED_ORPHANS/` or carry `orphan` authority. Canon-vs-orphan separation exists but orphan pile dominates.

## Related

- Full audit: [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)
- Companion earlier scan: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)
- Aug 9 forensic: [`docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md`](../../docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md)

— Claude (E84 Owner), 2026-08-16 13:20 EDT