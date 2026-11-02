# Dataiku DSS vs. Custom Open-Source MLOps

**Comparative Evaluation Dashboard**
**Use Case:** BroyhillGOP donor-upgrade prediction platform
**Frame:** BGOP already runs Postgres 16, custom ingestion (E61), custom identity resolution (Cat 13 grading, cluster_id spine), and has a mature multi-agent development workflow

---

## Executive Summary

| Dimension | Winner | Verdict |
|---|---|---|
| Time-to-first-model | **Dataiku** | Visual ML + Flow gets a working prototype in days |
| Extensibility via Python | **Custom OSS** | Every library, every version, no MLflow flavor gaps |
| Model-governance schemas | **Dataiku** (out-of-box) / **Custom OSS** (with effort) | DSS bundles this; OSS requires MLflow + custom UI |
| Long-term API cost | **Custom OSS** | No per-user seat licensing; pay only for compute |
| Architectural overhead | **Dataiku** for small teams, **Custom OSS** for BGOP | BGOP already has infrastructure; DSS adds a control-plane layer |
| Alignment with BGOP moat | **Custom OSS** | Donor-intelligence moat is bespoke by design (donor-centric-architecture, LP decision engine, race-relational scoring) |

**Recommendation for BGOP:** Do not adopt Dataiku as the primary platform. The BGOP moat is the bespoke donor intelligence layer, which Dataiku would either wrap (adding overhead) or force into visual patterns that don't fit the LP/two-tower architecture. Consider Dataiku only for **workflow-heavy, analyst-facing sub-projects** where visual Flow authoring is a genuine win (e.g., ad-hoc voter file analysis by non-engineers).

---

## 1. Extensibility via Python APIs

### Dataiku

**Strengths:**
- Two-package model (`dataiku` internal, `dataikuapi` external) covers most needs
- Custom scikit-learn algorithms plug straight into visual ML with `fit`/`predict`/`classes_`
- Plugin system packages custom recipes as reusable components
- Recipe builder pattern is clean for programmatic flow generation

**Constraints:**
- Custom algorithms must be scikit-learn-compatible — non-conforming estimators (e.g., a two-tower recommender with dot-product retrieval, per `donor-centric-architecture` spec) require wrappers
- MLflow import gaps: no R, no Spark, LightGBM multiclass unsupported ([MLflow limitations](https://doc.dataiku.com/dss/latest/mlops/mlflow-models/limitations.html))
- Code environments are DSS-managed virtualenvs — pinning must go through the DSS UI or `DSSCodeEnv` API, not standard `requirements.txt` in Git
- Java-optimized scoring restricts preprocessing to a subset of transformations ([Scoring engines](https://doc.dataiku.com/dss/latest/machine-learning/scoring-engines.html))

### Custom OSS Stack

**Reference stack for BGOP:**

| Layer | Tool | Rationale |
|---|---|---|
| Experiment tracking | **MLflow** | Industry-standard, matches BGOP's existing pattern |
| Feature store | **Feast** (Postgres offline store, Redis online) | Aligns with Hetzner Postgres truth source |
| Model serving | **BentoML** or **Seldon Core v2** | Python-native, no Java scoring restrictions |
| Orchestration | **Prefect** or **Dagster** | Better DAG semantics than DSS Scenarios; Git-native |
| Monitoring | **Evidently** + Grafana | Drift + performance in code, not a UI |
| Registry / governance | **MLflow Model Registry** + custom Postgres audit tables | Fits BGOP's audit trail patterns |

**Strengths:**
- Every Python library, every version, no flavor gaps
- Everything is code and Git-versioned — matches BGOP's PR-driven workflow with Cursor/Claude/Codex
- Two-tower / LP decision engine / heat tensor models sit natively — no wrapper layer

**Constraints:**
- You build the integration surface yourself (auth, RBAC, UI, drift dashboards)
- Requires disciplined DevOps — Docker, K8s manifests, secret management
- No visual Flow — analysts without Python are locked out

**Score:** **Custom OSS wins** for BGOP because the donor-intelligence layer is *inherently* non-visual and code-first.

---

## 2. Ease of Maintaining Model-Governance Schemas

### Dataiku

- **Saved Model registry** with versions, active version, evaluation history — free
- **Model Evaluation Store** captures per-run metrics automatically
- **Drift analysis** (KS, Chi-square, PSI, domain classifier) shipped in the UI
- **AI Governance** module (extra SKU) adds sign-off workflows, approvals, model cards, regulatory reporting

**Gotcha:** Governance schemas are stored in DSS's internal Postgres/H2 — extracting for audit purposes requires the public API and normalization work.

### Custom OSS

- **MLflow Model Registry** stages: `None` → `Staging` → `Production` → `Archived`
- Custom `model_governance` Postgres schema for BGOP: `model_id`, `version`, `training_data_snapshot_id`, `feature_hash`, `metrics_json`, `approved_by`, `approved_at`, `deprecated_at`, `race_scope`, `candidate_id_scope`
- Drift: Evidently generates JSON reports checked into Git or written to Postgres
- Approval workflows: implement via BGOP's existing candidate-portal + audit-log pattern

**Score:** **Dataiku wins out of the box** — a small team gets governance for free. **BGOP-specific score: tie** — BGOP already has audit-trail patterns (E10 governance) that would be duplicated by DSS.

---

## 3. Long-term Costs

### Dataiku Pricing Reference

Per [InfoWorld review](https://www.infoworld.com/article/2265977/dataiku-review-data-science-fit-for-the-enterprise.html) (self-hosted plans, publicly disclosed tiers as of 2021 — enterprise pricing has since become subscription-negotiated):

| Plan | Users | Approximate Cost | Notes |
|---|---|---|---|
| Community | 3 | Free | Design node only, no API Deployer, no governance |
| Discover | 5 | ~$3-5K/yr | Limited features |
| Business | 20 | ~$40-80K/yr | Full features minus AI Governance |
| Enterprise | Custom | **$100K – $500K+/yr** | Full features, AI Governance, MLOps SKU |

**Hidden costs:**
- Additional API node licenses (per node or per core)
- AI Governance module often priced separately
- Professional Services for onboarding (~$50-100K)
- Kubernetes cluster + compute (not included)

### Custom OSS

**Software:** $0 licensing. All components (MLflow, Feast, BentoML, Seldon, Prefect, Evidently) are Apache 2.0 or MIT.

**Infrastructure (BGOP-scale, 3-5 API instances behind LB):**

| Item | Monthly Cost |
|---|---|
| 3× Hetzner CX41 API nodes (4 vCPU, 16 GB) | ~$100 |
| Hetzner LB11 load balancer | ~$6 |
| Redis (managed or self-hosted) for Feast online store | ~$30 |
| Postgres already provisioned (Hetzner truth source) | $0 (existing) |
| S3-compatible object store (Hetzner Object Storage) for artifacts | ~$10 |
| **Total infrastructure** | **~$150/mo → ~$1,800/yr** |

**Engineering time:** 3-6 weeks initial build, 0.2 FTE ongoing maintenance.

**5-year TCO (rough):**

| Option | Year 1 | Year 5 (cumulative) |
|---|---|---|
| Dataiku Enterprise (20 users) | $50-80K | $250-400K |
| Custom OSS | $60-100K (build + infra) | $80-140K |

**Score:** **Custom OSS wins on cost** at BGOP scale by a 2-3× factor over 5 years.

---

## 4. Architectural Overhead for BGOP

### Dataiku Overhead

**What Dataiku forces you to adopt:**
- A parallel data model (DSS datasets shadow Postgres tables)
- DSS Scenarios instead of Prefect/cron
- DSS code environments instead of standard `pyproject.toml`
- DSS Git integration (per-project) instead of monorepo Git
- API Designer instead of FastAPI/BentoML
- DSS user model instead of BGOP's candidate-silo RBAC

**Where friction hits BGOP explicitly:**
- **Canonical donor join keys** (`rnc_regid`, `cluster_id`) — DSS's dataset abstraction adds a layer, and enforcement of the sacred canary (cluster 372171 = 147 txns / $332,631.30) becomes a per-scenario check instead of a DB-side constraint
- **Multi-tenant candidate silos** — DSS RBAC is project-scoped, not row-scoped; enforcing candidate-silo isolation in DSS requires per-candidate project cloning or bespoke RLS at the Postgres layer anyway (making DSS's ACL redundant)
- **LP decision engine** — DSS has no first-class LP/MIP solver integration; you'd wrap OR-Tools/HiGHS in a Python recipe, at which point the visual Flow is not adding value
- **News-driven heat tensor** — 60-second tick cadence is well below DSS scenario minimum (1-2 min per [Dataiku KB](https://knowledge.dataiku.com/latest/admin-operating/instance-monitoring/tutorial-monitor-api-services.html))

### Custom OSS Overhead

**What you build once:**
- FastAPI or BentoML service definitions per model (~100 LOC each)
- Prefect/Dagster flows for scoring pipelines (Python, Git-versioned)
- MLflow tracking server (single container)
- Evidently drift reports as scheduled scenarios
- Grafana dashboards over Postgres/Prometheus

**Alignment with BGOP existing infrastructure:** near-total. Everything sits alongside the Hetzner truth source, respects the sacred canary via DB constraints, integrates with BGOP's audit-log tables, and works with the existing multi-agent (Cursor/Claude/Codex) workflow.

**Score:** **Custom OSS wins decisively for BGOP.** Dataiku's abstractions duplicate what BGOP has already built and would fight the LP/heat-tensor architecture.

---

## 5. Extensibility for Donor Upgrade Predictions Specifically

### Fit Analysis Against BGOP's Donor Upgrade Model

Per `donor-contribution-forecasting` and `donor-centric-architecture` skills, the BGOP donor model requires:

| Requirement | Dataiku Fit | Custom OSS Fit |
|---|---|---|
| BG/NBD + Gamma-Gamma frequency/monetary model | Custom Python algorithm (wrapped) | Native `lifetimes` package, direct integration |
| Two-tower recommender (donor tower × candidate tower, dot product) | Not a fit for visual ML; would live in a Python recipe | Native (TensorFlow Recommenders / PyTorch) |
| Kalman state-space updates from E63 heat tensor | Python recipe + custom state store | Native (`pykalman` or custom, in Prefect flow) |
| 2,550+ variable donor signature with pgvector ANN | Postgres pgvector direct | Postgres pgvector direct |
| Candidate-scoped pseudonymous IDs at recommendation surface | Requires bespoke logic in API Node endpoint | Native FastAPI/BentoML middleware |
| Per-candidate LP objective (Σ Expected Net Revenue) | Not supported; Python recipe wrapper | OR-Tools/HiGHS/Gurobi direct |
| 60-second heat tick cadence | Below scenario minimum | Native (Prefect deployments, Redis Streams) |
| Race-relational scoring (office class × donor fingerprint) | Feature engineering fits; model doesn't fit visual ML | Native |

**Verdict:** Dataiku wraps most of these but adds nothing — the code lives in Python recipes anyway. The visual Flow provides no lift because the interesting work is not tabular transformations.

---

## 6. Scoring Matrix (0-5 scale)

| Criterion | Weight | Dataiku | Custom OSS |
|---|---|---|---|
| Extensibility via Python | 20% | 3 | **5** |
| Model-governance schemas | 10% | **4** | 3 |
| Long-term cost | 15% | 2 | **5** |
| Architectural overhead (BGOP-aligned) | 20% | 2 | **5** |
| Fit to donor-intelligence moat | 20% | 2 | **5** |
| Analyst self-service (non-coders) | 10% | **5** | 2 |
| Vendor risk / lock-in | 5% | 2 | **5** |
| **Weighted total** | **100%** | **2.7** | **4.6** |

---

## 7. Where Dataiku Might Still Earn a Slot

Even given the recommendation against DSS as primary platform, targeted use cases exist:

1. **Voter-file exploratory analysis** by non-engineering staff (interns, field organizers) — visual Prepare + Chart is faster than Superset for one-off questions
2. **NCSBE/FEC quarterly filings QA** — visual Flow can be a checklist-driven schema-diff tool
3. **Vendor data profiling** — DSS's automatic column profiling is genuinely useful for a first pass on Acxiom/DataTrust deliveries
4. **Cross-candidate reporting** for NCRDC leadership (Don Flow-style stakeholders) — the DSS dashboards let a business user drill without hitting Postgres

For each of these, the *free Community Edition* (3 users, Design node only) is likely sufficient. **Do not upgrade to an Enterprise contract for these use cases** — cost/benefit does not clear.

---

## 8. Migration Cost If BGOP Later Adopts Dataiku

If a future NCRDC-level mandate forces DSS adoption:

| Component | Migration Effort |
|---|---|
| Postgres schema | Zero (DSS reads directly) |
| SQL transformations | Low (SQL recipes) |
| Python feature engineering | Low-Medium (Python recipes) |
| Custom estimators (two-tower, LP engine) | **High** — must wrap in scikit-learn interface or run outside DSS via API |
| Multi-agent Cursor/Claude workflow | **High** — DSS UI-first, agents work over the public API but lose IDE fidelity |
| Sacred canary discipline | **Medium** — must reimplement via DSS metrics + checks |
| CI/CD | **High** — DSS's project bundle mechanism doesn't map cleanly to standard Git PR workflow |

Total estimated migration: **3-6 months, 2 FTEs.**

---

## 9. Decision Framework

Adopt **Dataiku** if any of these become true:
- Team size exceeds 20 non-engineering analysts who need visual data prep
- A regulatory mandate requires an off-the-shelf governance module (unlikely for NC state-level campaigns)
- NCRDC signs an enterprise contract that includes DSS at no marginal cost

Stay with **Custom OSS** (recommended) as long as:
- The donor-intelligence moat remains the platform's core differentiator
- BGOP maintains its multi-agent, Git-native, PR-driven workflow
- Compute is on Hetzner or a similarly cost-efficient host
- The team is code-first (which is currently the case)

---

## Primary Sources

- [InfoWorld — Dataiku pricing](https://www.infoworld.com/article/2265977/dataiku-review-data-science-fit-for-the-enterprise.html)
- [Dataiku Enterprise MLOps](https://www.dataiku.com/product/mlops)
- [Dataiku — MLflow model limitations](https://doc.dataiku.com/dss/latest/mlops/mlflow-models/limitations.html)
- [Self-healing API service deployments on Kubernetes](https://knowledge.dataiku.com/latest/admin-operating/instance-monitoring/tutorial-monitor-api-services.html)
- [MLflow Model Registry docs](https://mlflow.org/docs/latest/model-registry.html)
- [Feast — Feature Store](https://docs.feast.dev/)
- [BentoML documentation](https://docs.bentoml.com/)
- [Seldon Core](https://www.seldon.io/solutions/core)
- [Evidently AI](https://docs.evidentlyai.com/)
