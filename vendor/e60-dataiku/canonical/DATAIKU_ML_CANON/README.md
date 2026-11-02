# BGOP Reference Artifact Bundle — Nexus Handoff v2

**Issued:** 2026-07-19 04:06 EDT
**From:** Ed Broyhill via Perplexity Computer
**To:** Nexus (execution agent)
**Sacred canary:** cluster_id 372171 = 147 txns / $332,631.30

---

## What this bundle contains

| File / Path | Role |
|---|---|
| `NEXUS_CORRECTION_PACKET_2026-07-19.md` | **Authority.** 17 sections of precise corrections. Read first, in full. |
| `MANIFEST_v2.txt` | SHA-256 lineage. Every preserved file pre-hashed. Nexus fills the NEW-artifact slots. |
| `README.md` | This file. |
| `04_bentoml_mlflow_feast_reference_architecture.md` | v4 source — DO NOT overwrite. Nexus produces `04_..._v5.md` separately. |
| `05_ui_settings_forms_stats_reference.md` | v1 source — DO NOT overwrite. Nexus produces `05_..._v2.md` separately. |
| `stats_algorithm_index.html` | v1 source — DO NOT overwrite. Nexus produces `stats_algorithm_index_v2.html` separately. |
| `diagrams/*.png` (5 files) | v1 source diagrams. Copy byte-identical into `diagrams_v2/` unless regenerated (record in change ledger). |
| `01_dataiku_technical_audit.md` | Lineage only — not revised in this packet. |
| `02_dataiku_vs_custom_mlops_dashboard.md` | Lineage only — not revised in this packet. |
| `03_dataiku_api_node_performance_tuning.md` | Lineage only — not revised in this packet. |

## What Nexus produces (must appear in the return bundle)

- `04_bentoml_mlflow_feast_reference_architecture_v5.md`
- `05_ui_settings_forms_stats_reference_v2.md`
- `stats_algorithm_index_v2.html`
- `diagrams_v2/` — 5 PNGs, byte-identical to `diagrams/` unless a diagram was regenerated
- `CHANGE_LEDGER_v2.md` — one row per substantive change with verbatim old/new text (see packet §15)
- `MANIFEST_v2.txt` — with every `<TO BE FILLED BY NEXUS>` slot completed and the self-hash line filled

## Hard operating constraints (from packet §0)

1. **No overwrites** of any file in this bundle. New versions ship as new filenames.
2. **No DB writes.** No `psql`, no migrations, no INSERT/UPDATE/DELETE.
3. **No silent renames.** Every rename appears in the change ledger.
4. **No deployment.** No `docker`, `kubectl`, `systemctl`, or `gh workflow run`.
5. **No schema drift.** No touching of `core.*`, `raw.*`, `brain.*` schema. New tables remain DRY-RUN only.
6. **Diagrams travel with docs.** New Markdown ships alongside `diagrams_v2/`.
7. **Exact-phrase authorization gate.** This bundle does not authorize any destructive action. Ed issues the phrase separately if follow-on writes are needed.

## Verification procedure (MANIFEST_v2.txt §STEPS 1–6)

Before starting: verify every PRESERVED sha256 matches with `sha256sum`.
After finishing: verify PRESERVED hashes still match, fill NEW slots, self-hash the manifest, run the sacred canary check.

## Acceptance gate

Packet accepted only when:
- Every PRESERVED sha256 matches (pre- and post-flight)
- Every NEW slot is filled with a real sha256 (no `<TO BE FILLED>` tokens remain)
- Sacred canary passes: `cluster_id = 372171` returns 147 txns / $332,631.30
- `CHANGE_LEDGER_v2.md` exists and its sha256 appears in MANIFEST §1
- Zero DB writes, zero SQL execution, zero deployment performed

## If anything drifts

**STOP.** Do not continue. Notify Ed. The packet is designed to fail loudly rather than proceed silently.

---
*Bundle sha256 recorded in the sibling file `nexus_handoff_v2.zip.sha256` after zip creation.*
