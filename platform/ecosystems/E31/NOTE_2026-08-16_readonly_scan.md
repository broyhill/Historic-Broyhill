# E31 NOTE — 2026-08-16 read-only scan

**Author:** Claude (E84 Owner)
**Date:** 2026-08-16 13:00 EDT
**Method:** Read-only inspection via live E84 library search index.
**Composite audit:** [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)

## Housekeeping anomaly — sibling directory

`AGENT_BOOT/ECOSYSTEM FILES/` contains two E31 directories:

- `AGENT_BOOT/ECOSYSTEM FILES/E31/` — the standard slot
- `AGENT_BOOT/ECOSYSTEM FILES/E31_SMS_MMS/` — sibling with a domain suffix

No other numbered ecosystem in the corpus has this pattern. Every other slot is `E00/` through `E87/` with no domain-suffix siblings.

## Likely cause

A rename or split that never reconciled. Either:
1. The `E31_SMS_MMS/` sibling was created to isolate a sub-scope (SMS/MMS lane) but never merged back.
2. The `E31/` folder was created after `E31_SMS_MMS/` existed, and both were kept.

Not urgent — no user-facing bug, no ranking impact — but future readers of `AGENT_BOOT/ECOSYSTEM FILES/` will trip on the naming inconsistency.

## Open items for future rulings

1. **Housekeeping ruling.** Merge `E31_SMS_MMS/` into `E31/`, or rename to something aligned with the E31 SPEC (Messaging / SMS / MMS / RVM / Live Call per E31–E33 messaging stack).
2. Confirm the E31 canonical identity (Messaging) still holds after the merge.

## Corpus context

E31 in the primary_eco census: 99 primary docs, 569 any-mention docs. Authority mix looks normal from the composite scan. No other E31 anomalies flagged this session.

## Related

- Composite audit: [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)

— Claude (E84 Owner), 2026-08-16 13:00 EDT
