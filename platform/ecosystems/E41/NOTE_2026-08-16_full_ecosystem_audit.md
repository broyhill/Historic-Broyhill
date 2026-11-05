# E41 NOTE — 2026-08-16 full ecosystem audit

**Identity:** Campaign Builder
**Wiki page present:** no
**Author:** Claude (E84 Owner)  
**Date:** 2026-08-16 13:20 EDT  
**Method:** Read-only three-lens sweep. No Postgres reads, no writes.  
**Full audit:** [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)

## Lens metrics

| Lens | Metric | Value |
|---|---|---:|
| Graphify AST | Nodes | 1,952 |
| Graphify AST | Top path prefixes | database(1), UNDEPLOYED BROYHILLGOP CODE(1), ECO_CANONICAL(1) |
| Graphify AST | Top cross-eco edges (out) | — |
| E84 catalog | Primary docs | 33 |
| E84 catalog | Any-mention docs | 220 |
| E84 catalog | Authority: orphan | 15 |
| E84 catalog | Authority: recovered | 3 |
| E84 catalog | Authority: doc | 10 |
| E84 catalog | Authority: spec | 0 |
| E84 catalog | Authority: test | 0 |
| E84 catalog | File types (py/md/sql) | 7/19/3 |
| E84 catalog | Deployed slice files | 1 |
| E84 catalog | Orphan slice files | 16 |
| E84 catalog | Spec files recognized | 1 |
| DB coupling | Objects written | 7 |
| DB coupling | Objects read | 0 |
| DB coupling | Handoffs (source→other) | 0 |
| DB coupling | Handoffs (other→target) | 0 |
| DB coupling | Contention objects | 0 |

## Health flags

- **HEAVY-ORPHAN** — >40 % of primary docs sit under `NONDEPLOYED_ORPHANS/` or carry `orphan` authority. Canon-vs-orphan separation exists but orphan pile dominates.
- **NO-WIKI** — >20 primary docs but no `memory/knowledge/projects/e##-*.md` wiki page. Real footprint, no durable identity page.
- **WRITE-ONLY-DB** — >3 DB writes and 0 DB reads in `sql_schema_read_v2`. Nothing reads what this eco writes — dead code, missing readers, or misidentified writes.

## Related

- Full audit: [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)
- Companion earlier scan: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)
- Aug 9 forensic: [`docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md`](../../docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md)

— Claude (E84 Owner), 2026-08-16 13:20 EDT