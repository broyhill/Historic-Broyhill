# E01 NOTE — 2026-08-16 full ecosystem audit

**Identity:** Donor Intelligence (WIKI)
**Wiki page present:** yes
**Author:** Claude (E84 Owner)  
**Date:** 2026-08-16 13:20 EDT  
**Method:** Read-only three-lens sweep. No Postgres reads, no writes.  
**Full audit:** [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)

## Lens metrics

| Lens | Metric | Value |
|---|---|---:|
| Graphify AST | Nodes | 17,656 |
| Graphify AST | Top path prefixes | core(1), database(1), UNDEPLOYED BROYHILLGOP CODE(1) |
| Graphify AST | Top cross-eco edges (out) | →E31:57, →E60:14, →E61:12 |
| E84 catalog | Primary docs | 337 |
| E84 catalog | Any-mention docs | 839 |
| E84 catalog | Authority: orphan | 143 |
| E84 catalog | Authority: recovered | 69 |
| E84 catalog | Authority: doc | 92 |
| E84 catalog | Authority: spec | 2 |
| E84 catalog | Authority: test | 7 |
| E84 catalog | File types (py/md/sql) | 61/130/105 |
| E84 catalog | Deployed slice files | 5 |
| E84 catalog | Orphan slice files | 163 |
| E84 catalog | Spec files recognized | 1 |
| DB coupling | Objects written | 19 |
| DB coupling | Objects read | 13 |
| DB coupling | Handoffs (source→other) | 15 |
| DB coupling | Handoffs (other→target) | 3 |
| DB coupling | Contention objects | 6 |

## Health flags

- **HEAVY-ORPHAN** — >40 % of primary docs sit under `NONDEPLOYED_ORPHANS/` or carry `orphan` authority. Canon-vs-orphan separation exists but orphan pile dominates.
- **HIGH-CONTENTION** — Shares 5+ database objects with other writers. Real coordination surface — cross-eco conflicts hide here.

## Related

- Full audit: [`docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md`](../../docs/audits/E84_FULL_ECOSYSTEM_AUDIT_2026-08-16.md)
- Companion earlier scan: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)
- Aug 9 forensic: [`docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md`](../../docs/audits/E84_FORENSIC_ARCHITECTURE_AUDIT_2026-08-09.md)

— Claude (E84 Owner), 2026-08-16 13:20 EDT