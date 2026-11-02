# E60 NOTE — 2026-08-16 full ecosystem audit

**Identity:** Campaign Profit Engine (WIKI)
**Wiki page present:** yes
**Author:** Claude (E84 Owner)  
**Date:** 2026-08-16 13:20 EDT  
**Method:** Read-only three-lens sweep. No Postgres reads, no writes.  
**Full audit:** [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)

## Lens metrics

| Lens | Metric | Value |
|---|---|---:|
| Graphify AST | Nodes | 4,147 |
| Graphify AST | Top path prefixes | database(1), ECO_CANONICAL(1), STRANDED_RESCUE_2026-05-23(1) |
| Graphify AST | Top cross-eco edges (out) | →E31:13 |
| E84 catalog | Primary docs | 151 |
| E84 catalog | Any-mention docs | 564 |
| E84 catalog | Authority: orphan | 41 |
| E84 catalog | Authority: recovered | 7 |
| E84 catalog | Authority: doc | 82 |
| E84 catalog | Authority: spec | 1 |
| E84 catalog | Authority: test | 6 |
| E84 catalog | File types (py/md/sql) | 23/96/12 |
| E84 catalog | Deployed slice files | 0 |
| E84 catalog | Orphan slice files | 45 |
| E84 catalog | Spec files recognized | 2 |
| DB coupling | Objects written | 4 |
| DB coupling | Objects read | 1 |
| DB coupling | Handoffs (source→other) | 0 |
| DB coupling | Handoffs (other→target) | 0 |
| DB coupling | Contention objects | 0 |

## Health flags

- **NO-DEPLOYED-SLICE** — >20 primary docs but no `AS_DEPLOYED_*` files under `ECO_CANONICAL/E##/code/`. Spec exists; deployed truth does not.

## Related

- Full audit: [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)
- Companion earlier scan: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)
- Aug 9 forensic: [`docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md`](../../docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md)

— Claude (E84 Owner), 2026-08-16 13:20 EDT