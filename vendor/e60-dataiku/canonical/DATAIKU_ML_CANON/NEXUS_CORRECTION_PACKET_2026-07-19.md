# NEXUS CORRECTION PACKET — BGOP Reference Artifact Bundle
**Date:** 2026-07-19 03:55 EDT
**Authority:** Ed Broyhill
**Scope:** Controlled revision of 4 artifacts. New versions only. Originals preserved. Zero DB writes, zero SQL execution, zero silent renames.
**Sacred canary:** cluster_id 372171 = 147 txns / $332,631.30 (verify unchanged after every step).

---

## §0. NEXUS OPERATING CONSTRAINTS (READ FIRST)

1. **No overwrites.** Every corrected artifact ships as a new filename with an explicit version bump. Every pre-existing file is preserved bit-for-bit and included in the SHA-256 manifest.
2. **No DB writes.** No `psql`, no `dbt run`, no migrations, no schema DDL, no INSERT/UPDATE/DELETE. All SQL in these docs remains DRY-RUN annotated.
3. **No silent renames.** Every filename change is listed in §12 (Change Ledger).
4. **No deployment.** No `docker`, no `kubectl`, no `systemctl`, no `gh workflow run`.
5. **No schema drift.** Do not modify `core.*`, `raw.*`, `brain.*` schema. New tables proposed in Part E (e.g. `brain.capacity_reservations`) remain DRY-RUN only.
6. **Diagrams travel with docs.** New Markdown ships in a bundle directory that includes `diagrams/` populated with all referenced PNGs.
7. **Exact-phrase authorization gate.** This packet itself does not authorize any destructive action. Ed must issue the current-protocol phrase separately before Nexus applies any write-side follow-ups.

---

## §1. AUTHORITATIVE PAIR — VERSION DECLARATION

| Artifact class | Current source | New authoritative name | Version |
|---|---|---|---|
| BentoML + MLflow + Feast Reference Architecture (Markdown) | `04_bentoml_mlflow_feast_reference_architecture.md` (v4) | `04_bentoml_mlflow_feast_reference_architecture_v5.md` | **v5** |
| UI / Settings / Forms / Stats Reference (Markdown) | `05_ui_settings_forms_stats_reference.md` | `05_ui_settings_forms_stats_reference_v2.md` | **v2** |
| Interactive Math/Stats/Algorithm Index (HTML) | `stats_algorithm_index.html` (referred to in thread as "HTML (1)") | `stats_algorithm_index_v2.html` | **v2** |
| Diagram bundle | scattered PNGs in workspace `diagrams/` | `diagrams_v2/` shipped alongside the Markdown | **v2** |

Docs 01, 02, 03 (Dataiku trilogy) are not being revised in this packet but their citation status must be preserved in the SHA-256 manifest for lineage.

---

## §2. INDEX COUNT CORRECTIONS (`stats_algorithm_index_v2.html`)

**Verified with grep 2026-07-19 03:55 EDT:**

| Claim | Correct value | Evidence |
|---|---|---|
| Total entries in DATA array | **145** | `{ name:` occurrences = 145 |
| Orchestration category entries | **11** (not 10) | `cat: "orchestration"` occurrences = 11 |
| BGOP Moat category entries | **11** (retained as separate category) | `cat: "bgop-moat"` occurrences = 11 |

**Action:** any language in the packet, in the doc, or in prose describing "10 new orchestration entries" is incorrect — restate as **11 new orchestration entries** added in Part E of doc 05. The BGOP Moat category remains a distinct category with 11 of its own entries; do not merge, do not renumber.

---

## §3. DIAGRAM PACKAGE REPAIR

**Current state (verified):**
- All 5 PNGs exist on disk in `/home/user/workspace/diagrams/`:
  - `truth_source_flow.png` (607,945 bytes)
  - `bentoml_request_path.png` (324,397 bytes)
  - `cutover_phases.png` (351,626 bytes)
  - `wireframe_step3_prospector.png` (377,705 bytes)
  - `wireframe_step7_lp.png` (395,857 bytes)
- The Markdown docs reference all 5 via relative path `diagrams/foo.png`.
- **The delivery risk:** these PNGs never ship inside the .md file; a downloader of the Markdown alone gets missing images.

**Required Nexus action for `04_v5.md`:**
- The `diagrams/` directory MUST ship in the bundle alongside the .md.
- The three referenced figures in doc 04 (`truth_source_flow.png` §2, `bentoml_request_path.png` §7.2, `cutover_phases.png` §11) remain in place.
- **Add the Hetzner → Feast → BentoML truth-source diagram as a figure in the BentoML architecture's topology section** (§4 or §5, wherever topology is diagrammed). It currently only appears in §2; explicitly reference it a second time in the topology section, or move a copy there — do NOT duplicate the file, reference the same PNG.

**Required Nexus action for `05_v2.md`:**
- `diagrams/wireframe_step3_prospector.png` and `diagrams/wireframe_step7_lp.png` must be present in the bundle. Currently referenced at 05.md lines 545 and 569 — a bare Markdown download would render as broken images.

---

## §4. PROOF-STATE LABELS — REPLACE UNSUPPORTED "LIVE" CLAIMS

**Rule:** every `LIVE` label must carry a dated proof reference (URL + health response, GitHub SHA, deployment receipt, or live-schema evidence). Where proof is absent, downgrade the label using this ladder:

- `LIVE` — requires proof reference on the same line
- `CLAIMED LIVE — UNVERIFIED` — asserted by wiki but no receipt attached
- `CODE COMPLETE` — merged to main, not deployed
- `SQL HELD` — migration exists in `database/migrations/dryrun/*` but unapplied
- `DRY RUN` — code path exists but never invoked in production
- `DESIGN` — spec only

**Verified `LIVE` instances requiring proof-state review in `05.md`:**

| Line | Current text | Proposed downgrade |
|---|---|---|
| 464 | *"This section documents the live UI, not the aspirational..."* | Replace with: *"This section documents the design and current build state of the candidate portal. Each surface below carries its own proof-state label."* |
| 487 | `LIVE` on Home / Dashboard | Requires `/healthz` or URL proof; otherwise `CLAIMED LIVE — UNVERIFIED` |
| 488 | `LIVE (Steps 1, 2, 4, 5, 9)` on Wizard | Per-step proof required; steps without receipt → `CODE COMPLETE` |
| 490 | `LIVE (picker)` on Microsegments | 32 implemented / 198K assignments — cite wiki SHA or downgrade |
| 491 | `LIVE` on Donor Explorer | Requires proof; else `CLAIMED LIVE — UNVERIFIED` |
| 493 | `LIVE` on Notifications | Requires proof |
| 494 | `LIVE` on Events | Requires proof |
| 495 | `LIVE (E68 Step 6 hub)` on Content Studio | Requires proof; sub-studios likely `DESIGN` |
| 499 | `LIVE` on Settings | Requires proof |
| 532–541 | Wizard step statuses | Each `LIVE` needs a GH SHA or `/healthz`; else downgrade individually |

**Sentence at line 464 (the broadest overclaim):** must be softened. Suggested replacement text:
> *"This section documents the design of the BGOP candidate portal as of the wiki snapshot dated 2026-07-19. Individual surfaces below carry proof-state labels; do not read the header as blanket production certification."*

---

## §5. EMBEDDING-DIMENSION CONTRADICTION — RESOLUTION

**Evidence:**
- `04.md:105` — `vector_length: 2550` on the Feast feature view
- `04.md:208` — `# 2550-dim vector per donor-centric-architecture`
- `04.md:306` — `embedding, -- pgvector column, 2550 dims`
- `04.md:322-323` — `vector_index=True, vector_length=2550`
- `04.md:930, 984, 1046` — 2,550 repeated in glossary
- `05.md:1724` — `typically k=128`
- `05.md:1744` — `feast.donor_embedding (2550-d embedding, ivfflat index, cosine ops)`
- `HTML:646` — `"Embedding dim k (typically 128)","Donor signature width (2550+ vars)"`

**Diagnosis:** the docs conflate two distinct vectors:
1. **Raw donor signature (input feature width)** — 2,550+ variables. Not what pgvector stores.
2. **Learned two-tower embedding (output width)** — the k-dim projection, typically k=128, that gets ANN-indexed.

**Required Nexus corrections:**

| Location | Current | Corrected |
|---|---|---|
| `04.md:105` | `vector_length: 2550` | `vector_length: 128  # learned two-tower embedding; raw 2550-var signature is materialized separately, not ANN-indexed` |
| `04.md:208` | `# 2550-dim vector per donor-centric-architecture` | `# 128-dim learned embedding; separate 2550-var raw signature retained in core.donor_raw_signature` |
| `04.md:306` | `embedding, -- pgvector column, 2550 dims` | `embedding, -- pgvector column, 128 dims (two-tower output; raw signature stored separately)` |
| `04.md:322-323` | `vector_length=2550` | `vector_length=128  # learned embedding` + comment referring to 2550-var raw signature entity |
| `04.md:930` | glossary line calling 2550-dim embedding "first-class in Feast" | rewrite: raw signature (2550 vars) is first-class in Feast as a materialized entity view; the 128-dim two-tower embedding is the ANN-indexed derivative |
| `04.md:984` | glossary "Donor signature — 10-year × 2,550+ variable representation... materialized as pgvector donor_embedding" | separate into two glossary entries: **Donor signature** (2,550+ raw variables, materialized non-ANN) and **Donor embedding** (128-dim learned two-tower projection, pgvector-indexed) |
| `05.md:1724` | `\phi_D : \mathbb{R}^{2550+} \to \mathbb{R}^{k}` `(typically k=128)` | keep — this is the ONE correct line; use it as the canonical formulation |
| `05.md:1744` | `feast.donor_embedding (2550-d embedding, ivfflat index, cosine ops)` | `feast.donor_embedding (128-d two-tower embedding, ivfflat index, cosine ops); feast.donor_raw_signature (2550-var raw, non-indexed)` |
| `HTML:646` | keep both params — they refer to different vectors — but clarify | `"Learned embedding dim k (typically 128)","Raw donor signature width (2550+ input variables)"` |

**Nexus MUST NOT:** silently rename the pgvector column, run any ALTER TABLE, or touch existing embedding rows. All corrections are documentation-level. If the actual pgvector column in the deployed schema is currently 2550-wide, that is a separate remediation ticket outside this packet's scope.

---

## §6. LP FORMULATION — CORRECTED FUNNEL UNIT

**Current formulation (in `05.md` Part C §5.14.1 and Part E §E8):**
```
x[donor, candidate, channel, time]  ∈ {0,1}
```

**Corrected formulation:**
```
x[funnel_instance, donor, candidate, weapon, tick]  ∈ {0,1}
```

**Required Part E §E8 additions:**

Each of the seven constraint families below must appear explicitly in the extended LP, with equations. Part E §E8.1–8.4 already contains four of these; the packet requires all seven to be present and consistently named:

1. **Sequence precedence** — `x[F,d,c,k_{i+1},t_{i+1}] ≤ x[F,d,c,k_i,t_i]` ∀ ordered pairs in F's genome. *(present §E8.1)*
2. **Simultaneous weapon steps** — allow `Σ_k x[F,d,c,k,t] > 1` when the play genome explicitly declares co-firing (e.g., email+SMS at T+7). Add this as a NEW constraint clause, not a modification of the "one channel per donor" solver default. *(NEW — currently absent)*
3. **Adaptive replanning** — the FSM in §E3 already covers state; add the LP-side note that the solver is re-invoked at each pulse-machine HOLD/RELEASE event, taking the current `x[F,d,c,k,t]` snapshot as a warm-start. *(present in FSM but not tied to the LP formulation — must be tied)*
4. **Cross-funnel fatigue** — `Σ_F Σ_k Σ_t∈W x[F,d,c,k,t] · fatigue_cost(k) ≤ F_d(W)` ∀ donor d, window W. *(present §E8.3)*
5. **Weapon cooldown** — for any two consecutive fires of the same donor by weapon k, `t_{fire2} - t_{fire1} ≥ cooldown(k)` per the E1 taxonomy. *(NEW — currently only in E1 table narrative)*
6. **Multi-donor blast radius** — the overlap penalty from §E8.2 must also carry a HARD cap for cannons with blast > 1 (social organic, social paid, peer/bundler, print insert): `Σ_d∈Blast(F,k) x[F,d,c,k,t] ≤ blast_hard_cap(k)`. *(NEW — currently only soft penalty λ)*
7. **Sequence-completion** — `x[F,d,c,k_n,t_n] ≤ x[F,d,c,k_1,t_1]` and `P_complete(F,d)` posted for post-mortem attribution. *(implicit in precedence but must be stated as a completion probability constraint feeding §E9 forecaster)*

**Required `scripts/lp_solver_exact.py` update note (DRY RUN, no code push):** the `Donor` and `ChannelSpec` dataclasses become `FunnelInstance` and `WeaponSpec`; `x[(i, ch.name)]` becomes `x[(F, i, c, k, t)]`. Marked as follow-on ticket, NOT part of this packet.

---

## §7. GEAR SEMANTICS — SEPARATED BY LAYER

**Rule:** three independent concepts, three independent representations. Never conflate.

| Layer | Representation | Values | Naming |
|---|---|---|---|
| Candidate UI (E68 Wizard Tier B) | Four forward gears | whisper / matinee / premiere / 1812 Overture | Theatrical names, no numbers shown |
| Control plane (variance doctrine) | Signed ±4 gearbox | −4 / −3 / −2 / −1 / 0 / +1 / +2 / +3 / +4 | Numeric, signed |
| Funnel lifecycle (§E3 FSM) | State machine | template → armed → mid-flight → paused → re-planning → firing → cooling → completed → post-mortem → aborted | State names |

**Required corrections wherever the docs currently conflate:**

- **No "L0 cool-down gear."** Cooling is a lifecycle FSM state, not a gear position. If any text implies gear 0 = cooling, rewrite: gear 0 = neutral dial position; `cooling` is a funnel-instance state independent of gear.
- **Downshifts are asymmetric.** -4 fires without persistence gate (compliance handbrake). Any text implying symmetric persistence for upshift/downshift is incorrect. Currently correct in Variance Doctrine §4, must remain correct in doc 05 Part E §E4.2 — verify no drift.
- **Tier A vs Tier B mapping.** The four theatrical names appear ONLY in Tier B UI text. Tier A (staff, Inspinia) uses numeric gears throughout. Do not leak theatrical names into control-plane code or logs.

---

## §8. CANNON COUNT — PARAMETERIZED

**Current state:**
- Doc 04, doc 05 Part E §E1, HTML index, all use **16**.
- Other platform materials (per Ed 2026-07-07 session, E68 §5.1) reference **18** with Directive Cannons #14/#15 unresolved.

**Required:**

1. **Retain as open ruling** in §E13 rulings (currently ruling #1) — do NOT close it. The Nexus revision keeps this open.
2. **No hardcoding.** No algorithm, no UI screen, no LP constraint, no test fixture may use the literal `16` or `18` for cannon count. All cannon-count references must resolve at runtime from a registry table:
   - Proposed registry: `brain.weapon_registry(weapon_id, weapon_name, ecosystem, munitions[], blast_radius, min_gap, max_per_funnel_30d, cooldown, unit_cost, active_since, active_until, source_doctrine)` — DRY-RUN only, do not create.
3. **Docs display the count as `|Weapons| = N` with a footnote** citing the registry snapshot date and the open ruling. Doc 04, doc 05 Part E §E1, HTML index all must adopt this convention.
4. **`stats_algorithm_index_v2.html` line 707** — the phrase "all 16 cannons in orchestrated score" must become "all |Weapons| cannons per active registry snapshot (see open ruling §E13.1)".

---

## §9. PORT 8083 COLLISION — MUST RESOLVE OR MARK UNRESOLVED

**Evidence:**
- `05.md:481` — E25 candidate portal: *"Deploy #5 brought E25 up on Hetzner as HTTP on `127.0.0.1:8083`"*
- `05.md:1709` — E60 LP solver: *"`backend/python/ecosystems/e60_profit_engine/lp_solver.py` — port 8083"*
- `HTML:642` — LP entry: *"Consumed by E68 Wizard Step 7 via /lp/solve on port 8083"*

Two distinct services cannot occupy the same host:port. Nexus must resolve to one of the following:

**Option A — different hosts, same port** (most likely case):
- E25 candidate portal: `hetzner-app-01:8083` (or whichever host runs E25)
- E60 LP solver: `hetzner-ml-01:8083` (per doc 04's proposed topology)
- **Every 8083 reference must include the host prefix.**

**Option B — different ports** (safer):
- E25 stays on 8083.
- E60 LP solver moves to a different port (proposal: 8084 or 8090).
- **Any port change is a follow-on ticket, NOT part of this packet.**

**Option C — mark as unresolved**:
- Both locations get a footnote: *"Port assignment under review — see NEXUS_CORRECTION_PACKET §9 (2026-07-19)."*
- Add to §E13 rulings as new open ruling #7.

**Required action:** Nexus picks A, B, or C — but MUST NOT ship v5/v2 with the collision unmarked. Recommend Option C if evidence for A is not immediately verifiable.

---

## §10. PROPOSED vs INSTALLED — TOPOLOGY LABELING

**Rule:** every infrastructure component in doc 04 must be labeled as one of:
- **INSTALLED** — deployment receipt attached (SSH log, `kubectl get pods`, Hetzner console screenshot, `systemctl status`)
- **TARGET ARCHITECTURE** — designed but not deployed

**Components requiring label review in `04_v5.md`:**

| Line | Component | Current implicit status | Required label (unless receipt attached) |
|---|---|---|---|
| 50 | `hetzner-ml-01 (MLflow + Feast registry + Redis)` CX41 | reads as installed | **TARGET ARCHITECTURE** |
| 51 | `3× bento-api-XX (BentoML pods)` CX41 | reads as installed | **TARGET ARCHITECTURE** |
| 680 | `bento-api-XX` deployment note | reads as installed | **TARGET ARCHITECTURE** |
| 889 | `Build BentoML service... deploy to one bento-api-01` | Phase 1 plan | keep as **PHASE 1 — PLANNED** |
| 893 | `Deploy 3× bento-api-XX behind Hetzner LB11` | Phase plan | keep as **PHASE 2 — PLANNED** |
| 914 | `pgvector ANN` note | remedial | keep as **PHASE 3 — MITIGATION** |

**Ed's rule (verbatim from correction packet):** *"The three BentoML CX41 nodes, Redis, LB11, Kubernetes, MLflow, and Feast should be labeled TARGET ARCHITECTURE unless deployment receipts prove they exist."*

**Required Nexus action:** section header at top of doc 04 §4 (topology) must state:
> **All infrastructure below is TARGET ARCHITECTURE. No component in this section is confirmed deployed. Deployment receipts, when obtained, will move individual components to INSTALLED status with a dated proof reference.**

---

## §11. AUTHORIZATION PHRASE — GOVERNANCE RULING FLAG

**Evidence:**
- `04.md:43, 64, 185, 513, 521, 895, 1014` and `05.md:541, 578` — all use `I AUTHORIZE THIS ACTION`
- Correction packet asserts current protocol requires `Ed Authorized`

**Required Nexus action — DO NOT choose one silently:**

1. Add a new §E13 open ruling #7 (or #8 if the port collision took #7):
   > **Ruling #8 — Authorization exact-phrase.** The reference documents use `I AUTHORIZE THIS ACTION` throughout. Ed's current governance protocol (2026-07-19 correction packet) requires `Ed Authorized`. Both phrases exist in prior canon; the two-phrase divergence is unresolved. All documents currently use the older phrase; no silent update permitted. Awaiting explicit Ed ratification of the new canonical phrase before global rewrite.

2. In v5/v2 documents, **preserve the current `I AUTHORIZE THIS ACTION` text** but attach a footnote at each occurrence:
   > *"See §E13 open ruling #8. This phrase is under governance review; do not update in code or automation until Ed ratifies."*

3. **Do not touch `authorization-protocol` skill file** — that is Ed's ratification surface.

---

## §12. DONATION BOUNDARY — LANGUAGE FIREWALL

**Rule:** BGOP may compute an ask amount, present a landing page, and hand the donor off to WinRed/Anedot. BGOP **may not** be described as processing the donation, hosting the payment form, holding card data, or acting as a merchant of record.

**Required scan in `04_v5.md` and `05_v2.md`:**

Search for and correct any phrase that could imply BGOP processes payment:
- "process donation" → "hand off donation to WinRed/Anedot"
- "collect payment" → "route donor to WinRed/Anedot payment page"
- "capture card" → NEVER — flag as red-line and remove
- "PCI" mentions → BGOP is out-of-scope; if the phrase appears, add clarification: *"BGOP handles PII but not PCI; card data lives entirely at WinRed/Anedot."*
- "E64 conversion surface" language must retain the phrase *"hands donor to WinRed/Anedot"* explicitly.

**Nexus MUST NOT** update this without a full grep of both v5/v2 files. If ANY payment-processing language is found, list each occurrence in the change ledger.

---

## §13. DOCUMENT ORDER — PARTS A/B/C/D/E

**Current state in `05.md` (v1):** Parts appear in order A / B / D / E / C (Part C — Math/Stats/Algorithm Index — is placed AFTER Parts D and E).

**Two acceptable resolutions:**

**Option 1 (preferred): Reorder to A → B → C → D → E.**
- Move Part C (Math/Stats/Algorithm Index) to its natural position after Part B.
- Renumber cross-references. All section anchors (`§C5.14.1` etc.) preserved but moved.

**Option 2: Retain current order with explicit contents note.**
- Add a new §0 preamble immediately after the title:
  > **Document order note:** Part D (BGOP candidate portal) and Part E (Multi-Cannon Orchestration Matrix) precede Part C (Math/Stats/Algorithm Index) because they establish the operational context that Part C's algorithm entries reference. Readers wanting only the algorithm catalogue may skip directly to Part C.

**Recommendation:** Option 2 is lower risk (no cross-reference churn). Option 1 is cleaner long-term. Nexus should propose one and wait for Ed's ratification before applying.

---

## §14. SHA-256 MANIFEST — REQUIRED DELIVERABLE

Nexus must produce `MANIFEST_v2.txt` alongside the new artifacts containing:

```
# BGOP Reference Artifact Bundle v2 — 2026-07-19
# Every file's SHA-256, byte size, and version lineage.

<sha256>  <bytes>  04_bentoml_mlflow_feast_reference_architecture.md     (v4, PRESERVED)
<sha256>  <bytes>  04_bentoml_mlflow_feast_reference_architecture_v5.md (v5, NEW)
<sha256>  <bytes>  05_ui_settings_forms_stats_reference.md               (v1, PRESERVED)
<sha256>  <bytes>  05_ui_settings_forms_stats_reference_v2.md            (v2, NEW)
<sha256>  <bytes>  stats_algorithm_index.html                             (v1, PRESERVED)
<sha256>  <bytes>  stats_algorithm_index_v2.html                          (v2, NEW)
<sha256>  <bytes>  diagrams/truth_source_flow.png                         (unchanged)
<sha256>  <bytes>  diagrams/bentoml_request_path.png                      (unchanged)
<sha256>  <bytes>  diagrams/cutover_phases.png                            (unchanged)
<sha256>  <bytes>  diagrams/wireframe_step3_prospector.png                (unchanged)
<sha256>  <bytes>  diagrams/wireframe_step7_lp.png                        (unchanged)

# Docs 01/02/03 (Dataiku trilogy) are NOT revised in this packet.
# Their SHA-256 values are recorded here for lineage completeness only.
<sha256>  <bytes>  01_dataiku_technical_audit.md                          (unchanged)
<sha256>  <bytes>  02_dataiku_vs_custom_mlops_dashboard.md                (unchanged)
<sha256>  <bytes>  03_dataiku_api_node_performance_tuning.md              (unchanged)
```

---

## §15. OLD-TO-NEW CHANGE LEDGER (SKELETON — NEXUS FILLS IN)

Nexus must ship a `CHANGE_LEDGER_v2.md` listing every substantive change, one row per change:

| # | File | Line(s) old | Line(s) new | Old text (verbatim) | New text (verbatim) | Section of this packet |
|---|---|---|---|---|---|---|
| 1 | 04_v5 | 105 | tbd | `vector_length: 2550` | `vector_length: 128  # ...` | §5 |
| 2 | 04_v5 | 208 | tbd | `# 2550-dim vector` | `# 128-dim learned embedding; ...` | §5 |
| … | | | | | | |

**Zero rows may be undocumented.** If Nexus makes ANY change not listed in the ledger, it fails acceptance.

---

## §16. ACCEPTANCE CHECKLIST

Nexus must return, in the bundle:

- [ ] `04_bentoml_mlflow_feast_reference_architecture_v5.md` — with all §5, §10, §11, §12 corrections applied and change ledger entries.
- [ ] `05_ui_settings_forms_stats_reference_v2.md` — with §4, §6, §7, §8, §9, §11, §12, §13 corrections applied.
- [ ] `stats_algorithm_index_v2.html` — with §2, §5, §6 (HTML:646), §8 (line 707) corrections.
- [ ] `diagrams_v2/` — all 5 PNGs present, byte-identical to originals unless a diagram was regenerated (then note in ledger).
- [ ] `MANIFEST_v2.txt` — SHA-256 for every file in the bundle, including preserved originals.
- [ ] `CHANGE_LEDGER_v2.md` — one row per substantive change with verbatim old/new text.
- [ ] Entry counts verified: HTML has exactly 145 entries, 11 orchestration, 11 bgop-moat.
- [ ] Link validation: every `diagrams/*.png` reference in the new Markdown resolves to a file in the bundle.
- [ ] Zero unsupported `LIVE` claims: grep the new files for `\bLIVE\b`; every hit must have a same-line proof reference.
- [ ] Zero silent filename changes: any rename appears in §12 ledger.
- [ ] Sacred canary preserved: 372171 = 147 / $332,631.30 unchanged (verify no doc claims otherwise).
- [ ] Zero deployment, zero SQL execution, zero database writes performed during the revision.

---

## §17. WHAT THIS PACKET IS NOT

- Not a code deployment.
- Not a database migration.
- Not a schema change to `core.*`, `raw.*`, or `brain.*`.
- Not a re-authorization of `authorization-protocol` — that phrase question stays open per §11.
- Not a resolution of the 16-vs-18 cannon count — that stays open per §8.
- Not a decision on document reorder (§13) — Nexus proposes, Ed decides.

---

*NEXUS CORRECTION PACKET — issued 2026-07-19 03:55 EDT by Ed Broyhill via Perplexity Computer.*
*Sacred canary check required before and after any revision: 372171 = 147 / $332,631.30.*
