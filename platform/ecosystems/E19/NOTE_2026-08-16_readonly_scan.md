# E19 NOTE — 2026-08-16 read-only scan

**Author:** Claude (E84 Owner)
**Date:** 2026-08-16 13:00 EDT
**Method:** Read-only inspection via live E84 library search index.
**Composite audit:** [`docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md`](../../docs/audits/E84_READONLY_ECO_SCAN_2026-08-16.md)

## Identity confirmed

**E19 = Social Media.** High confidence.

### Evidence

| Signal | Source |
|---|---|
| Filename theme | `ecosystem_19_social_media*` (base, enhanced, manager, integration patch), `ecosystem_19_personalization_engine` |
| Description strings | "ecosystem 19 social media manager / enhanced / personalization engine" (repeated across 3 files) |
| Specification | `AGENT_BOOT/ECOSYSTEM FILES/E19/E19_SPECIFICATION.md` |
| Schema | `AGENT_BOOT/ECOSYSTEM FILES/E19/NONDEPLOYED_ORPHANS/2026-05-03_e19_social_schema.sql` |
| Deployed slice | `ECO_CANONICAL/E19/code/AS_DEPLOYED_HETZNER_2026-07-30/` — 4 Python modules |
| Reference architectures | `oktopost-social-publishing-clickdimensions-adaptation.md` (56 KB), `RASA_INTEGRATION_PLAN-2026-05-06.md` |

## Corpus health — poor

| Metric | Value | Interpretation |
|---|---:|---|
| Primary docs | 116 | Real mid-tier footprint |
| Under `NONDEPLOYED_ORPHANS/` | ~60 of 73 AGENT_BOOT entries | Bulk stranded |
| Under `AS_DEPLOYED_HETZNER_2026-07-30/` | 7 files | Tiny canonical deployed slice |
| Authority: `orphan` | 50 (43 %) | Nearly half orphan |
| Authority: `recovered` | 18 (16 %) | Archive recoveries |
| Authority: `doc` | 32 (28 %) | Normal doc-authority |
| Authority: `spec` | **1** | Only one file recognized as spec |
| Authority: `test` | 14 | Real test coverage exists |
| Wiki page under `memory/knowledge/projects/` | **missing** | No durable identity page |

## Authority-classifier gap

`E19_SPECIFICATION.md` and `E19_FUNNEL_STAGES.md` sit under `AGENT_BOOT/ECOSYSTEM FILES/E19/`. The E84 authority classifier does not promote them to `spec` authority — it defaults `AGENT_BOOT/` paths to `doc`/`orphan`. Result: E19 has real spec material treated as ordinary docs in ranking.

## Open items for future rulings

1. Create wiki page `memory/knowledge/projects/e19-social-media.md`.
2. Decide whether E19 spec material should be moved to `ECO_CANONICAL/E19/` or the classifier taught to recognize `AGENT_BOOT/ECOSYSTEM FILES/E##/E##_SPECIFICATION.md` as spec authority.
3. Rationalize `NONDEPLOYED_ORPHANS/` — many files may be safely archived or reclassified.

## Related

- Stamper rule-ordering bug affecting E19 vs E38 misstamps — see [`ECO_CANONICAL/E38/NOTE_2026-08-16_readonly_scan.md`](../E38/NOTE_2026-08-16_readonly_scan.md).

— Claude (E84 Owner), 2026-08-16 13:00 EDT
