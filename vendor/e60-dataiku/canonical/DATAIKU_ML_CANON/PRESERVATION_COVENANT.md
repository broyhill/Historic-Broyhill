# E60 DATAIKU ML CANON — PRESERVATION COVENANT

**Sealed:** 2026-08-09 · **Authority:** Ed Broyhill (EDGAR)
**Ed's ruling (verbatim, 2026-08-09):** "I want all these files sealed off from anyone deleting them and i want you to find the ecosystem we plant them as they are key to running this entire platform. … without them we fail"

## What this is

The complete Dataiku-class design memory for **E60 — Campaign Profit Engine**
(locked identity: `docs/canonical/E60_LOCKED_IDENTITY_DATAIKU_CLASS_2026-07-26.md`).
E60 is the platform's quantitative decisioning core — seven production mathematical
models + PuLP LP + faction-stratified Thompson arms + cost ledger, feeding E20 Brain
GO/NO-GO and the E68 Wizard ROI pane. These files are the architecture E60 is being
rebuilt from. Without them the platform's CFO cannot be built.

## Contents

| File | What |
|---|---|
| `01_dataiku_technical_audit.md` | Dataiku DSS institutional technical audit (API surface, schema model, algorithm library, MLOps) |
| `02_dataiku_vs_custom_mlops_dashboard.md` | Dataiku vs custom OSS MLOps comparative evaluation |
| `03_dataiku_api_node_performance_tuning.md` | Dataiku API node performance tuning checklist |
| `04_bentoml_mlflow_feast_reference_architecture.md` | BentoML + MLflow + Feast — BGOP reference architecture (the native-rebuild stack) |
| `05_ui_settings_forms_stats_reference.md` | Every screen, settings surface, form field, and math/stats algorithm — the algorithm index |
| `stats_algorithm_index.html` | Interactive math/stats algorithm index (HTML) |
| `NEXUS_CORRECTION_PACKET_2026-07-19.md` | Nexus correction packet for the reference artifacts |
| `MANIFEST_v2.txt` + `README.md` | Nexus Handoff Bundle v2 manifest + bundle README (restored 2026-08-09 — was lost from GitHub) |
| `diagrams/` | 5 architecture diagrams under their real names: `bentoml_request_path.png` and `cutover_phases.png` (restored 2026-08-09 — were lost from GitHub), `truth_source_flow.png`, `wireframe_step3_prospector.png`, `wireframe_step7_lp.png` |
| `framework_stubs/` | `nc_campaign_brain_framework.zip` contents — 12 one-line placeholder artifacts (taxonomy schema, brain core, optimization algorithms, deploy manifests). Stubs only; the real artifacts were never produced. Preserved as evidence of intended shape. |
| `SEAL_MANIFEST.sha256` | Content hashes of every sealed file |

Provenance: Ed's Dataiku.zip drop (2026-08-09) ⊃ `Dakeilu ML-files.zip` ⊃ Wizard-of-Oz
session `6b093d0d` (2026-07-19) + `nexus_handoff_v2.zip`. Prior partial copies:
`AGENT_BOOT/DATAIKU_ML_RECOVERY/2026-07-29_Dakeilu_ML_zip/` and
`AGENT_BOOT/ED_DROP_2026-08-08_SQL_AND_DATAIKU_ML/` (kept — not superseded, but this
directory is the canonical, complete, correctly-named set).

## The seal

1. **No agent may delete, move, rename, or rewrite anything under
   `ECO_CANONICAL/E60/DATAIKU_ML_CANON/` without Ed's explicit `AUTHORIZED` ruling.**
2. CI guard `.github/workflows/e60-seal-guard.yml` fails any PR that deletes or
   modifies a sealed file unless the PR body contains Ed's authorization phrase.
3. CODEOWNERS already routes all of `ECO_CANONICAL/` to @broyhill.
4. `SEAL_MANIFEST.sha256` is the integrity baseline: `sha256sum -c SEAL_MANIFEST.sha256`
   from this directory must pass.
