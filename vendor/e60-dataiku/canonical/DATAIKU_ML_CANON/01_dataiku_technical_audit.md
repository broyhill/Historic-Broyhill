# Dataiku DSS — Institutional Technical Audit

**Audience:** BroyhillGOP engineering + data-architecture team
**Purpose:** Reference document evaluating Dataiku DSS for donor-upgrade prediction, campaign scoring pipelines, and MLOps operations
**Scope:** API surface, schema model, algorithm library, MLOps/deployment patterns, integration surfaces

---

## 1. Platform Overview

Dataiku DSS is an end-to-end data science + MLOps platform organized around three node classes ([Dataiku Knowledge Base](https://knowledge.dataiku.com/latest/deploy/aiops-overview/concept-dataiku-architecture.html)):

| Node Type | Role | Typical Workloads |
|---|---|---|
| **Design Node** | Development environment | Flow authoring, model training, notebooks, plugin development |
| **Automation Node** | Batch production | Scheduled scenarios, batch scoring, retraining jobs |
| **API Node** | Real-time production | Low-latency prediction endpoints, dataset lookups |

The **API Deployer** publishes packages from Design → API Nodes (static infrastructure or Kubernetes), and can also deploy to external platforms including AWS SageMaker, Azure ML, Databricks, Google Vertex AI, and Snowflake Snowpark ([Dataiku Docs](https://doc.dataiku.com/dss/latest/apinode/api-deployment-infrastructures.html)).

---

## 2. API Surface Area

### 2.1 Two Python Packages

Dataiku ships two distinct Python packages, and confusing them is a common source of bugs ([Dataiku Developer Guide](https://developer.dataiku.com/latest/getting-started/dataiku-python-apis/index.html)):

| Package | Purpose | Where It Runs |
|---|---|---|
| `dataiku` | **Internal API** — data processing, ML tasks, dataset/model I/O inside recipes and notebooks | Inside DSS only (preinstalled) |
| `dataikuapi` | **Public/external API** — administration, project CRUD, deployment orchestration | Inside DSS (preinstalled) or externally (`pip install dataiku-api-client`) |

**Bootstrap patterns:**

```python
# Inside DSS
import dataiku
client = dataiku.api_client()                    # returns DSSClient
project = client.get_project("BROYHILLGOP_MAIN")

# Outside DSS
import dataikuapi
client = dataikuapi.DSSClient("https://dss.example", "YOUR_API_KEY")
project_keys = client.list_project_keys()
```

Both patterns are documented at [doc.dataiku.com/dss/11/python-api/client.html](https://doc.dataiku.com/dss/11/python-api/client.html).

### 2.2 REST API

All public REST endpoints are rooted at `/public/api/` on the DSS server and authenticate via a bearer API key ([Developer Guide](https://developer.dataiku.com/latest/getting-started/dataiku-python-apis/rest-api/index.html)):

```
GET  /public/api/projects/
POST /public/api/projects/                        # create project
GET  /public/api/projects/{key}/datasets/{ds}/schema
POST /public/api/projects/{key}/export
POST /public/api/projects/{key}/actions/push-to-git-remote
GET  /public/api/project-folders/{folderId}
```

The official recommendation is to prefer the Python client over raw HTTP — the client handles pagination, error mapping, and object hydration ([Dataiku Docs](https://doc.dataiku.com/dss/latest/publicapi/index.html)).

**Auth models supported:**
- Personal API key (per user, RBAC-scoped)
- Global API key (admin, instance-wide)
- OAuth2 (for API Services on the API node)

### 2.3 Core Object Hierarchy (`dataikuapi`)

Full reference: [doc.dataiku.com/dss/11/python-api/dataikuapi-reference.html](https://doc.dataiku.com/dss/11/python-api/dataikuapi-reference.html)

```
DSSClient
├── DSSProject                     # get_project(key)
│   ├── DSSProjectSettings         # code env, git, permissions
│   ├── DSSDataset                 # schema, metadata, partitions
│   ├── DSSManagedFolder           # unstructured artifact store
│   ├── DSSRecipe                  # 20+ recipe types (see §3.3)
│   ├── DSSSavedModel              # deployed ML artifact
│   ├── DSSMLTask                  # in-lab training task
│   ├── DSSScenario / DSSTrigger   # orchestration
│   ├── DSSAPIService              # API Designer service (endpoints)
│   └── DSSFlow                    # graph, zones, propagation
├── DSSConnection                  # DB, S3, filesystem
├── DSSCodeEnv                     # Python/R virtualenv
├── DSSUserMeaning                 # semantic column types
└── DSSAPIDeployer                 # infra + deployments
```

### 2.4 API Node User API (Real-Time Scoring)

Separate REST/Python API for calling deployed endpoints ([Dataiku Docs](https://doc.dataiku.com/dss/latest/apinode/api/user-api.html)):

```python
import dataiku
api_node = dataiku.APINodeClient("http://apinode:12000", "donor_upgrade_svc")
prediction = api_node.predict_record("v1_upgrade", {
    "rnc_regid": "NC-1234567",
    "cluster_id": 372171,
    "cumulative_amount_5y": 332631.30,
    "last_gift_days": 42
})
# → {"result": {"prediction": 1, "probas": {"0": 0.18, "1": 0.82}}}

# Batch mode (much higher throughput)
api_node.predict_records("v1_upgrade", [record1, record2, ...])
```

Endpoint types available: `PREDICTION`, `CLUSTERING`, `PYTHON_FUNCTION`, `R_FUNCTION`, `SQL_QUERY`, `DATASET_LOOKUP`, `SQL_LOOKUP`, `DATASETS_LOOKUP`.

---

## 3. Schema Structure

### 3.1 Project Schema

A DSS project is a self-contained unit stored on the Design node under `DATA_DIR/config/projects/{PROJECT_KEY}/`. Its authoritative state is a set of JSON files version-controlled via DSS's built-in per-project Git integration.

```
config/projects/{PROJECT_KEY}/
├── params.json                    # project metadata, owner, code env
├── permissions.json               # RBAC
├── flow.json                      # zones, connections
├── datasets/
│   └── {DATASET_NAME}.json        # schema, connection, partitioning
├── recipes/
│   └── {RECIPE_NAME}.json         # I/O, params, code (or code inline)
├── analysis/                      # Lab / ML tasks
├── saved_models/
│   └── {MODEL_ID}/                # versions/, active_version
├── api_services/
│   └── {SERVICE_ID}.json          # endpoints, auth
├── scenarios/
├── lib/                           # project-scoped Python/R library
└── code-envs/                     # per-project code environments
```

### 3.2 Dataset Schema Object

```json
{
  "userModified": true,
  "columns": [
    {"name": "rnc_regid",           "type": "string"},
    {"name": "cluster_id",          "type": "bigint"},
    {"name": "cumulative_amount",   "type": "double", "meaning": "USDAmount"},
    {"name": "last_gift_date",      "type": "date"}
  ]
}
```

Column `type` uses DSS storage types (`string`, `bigint`, `int`, `double`, `float`, `boolean`, `date`, `array`, `object`). Column `meaning` is a semantic type from either the built-in library or `DSSUserMeaning` — this is what feeds visual ML preprocessing decisions ([Dataset API reference](https://developer.dataiku.com/latest/api-reference/python/datasets.html)).

**Schema mutation rules** ([Dataiku Docs](https://doc.dataiku.com/dss/latest/schemas/recipes.html)):
- Visual recipes recompute output schema automatically at save time.
- Python/R/PySpark/SparkR recipes **do not** — the recipe must call `write_with_schema(df)` or explicitly `set_schema()`.
- Schema drift requires manual propagation via **Propagate schema across Flow from here** (or the equivalent API call).

### 3.3 Flow Schema

The Flow is a DAG of computables (datasets, managed folders, saved models) connected by recipes ([Dataiku Docs](https://doc.dataiku.com/dss/latest/flow/index.html)).

**Zones** partition the Flow into logical regions (`DSSFlowZone`). Rebuild modes per dataset: `Normal`, `Explicit`, `Write-protected` ([Rebuilding Datasets](https://doc.dataiku.com/dss/latest/flow/building-datasets.html)).

**Recipe catalog** (from the [dataikuapi ml.py source](https://github.com/dataiku/dataiku-api-client-python) and reference):

| Category | Recipe Types |
|---|---|
| **Visual** | Prepare, Group, Join, Stack, Window, Sync, Sample/Filter, Split, Sort, TopN, Distinct, Pivot |
| **Code** | Python, R, PySpark, SparkR, SQL, SparkSQL, Hive, Impala, Shell |
| **ML** | Train, Score, Evaluate, Standalone Evaluation, Clustering |
| **Special** | Application-as-recipe, Plugin recipe, Continuous |

Programmatic recipe creation follows a builder pattern ([Developer Guide](https://developer.dataiku.com/latest/concepts-and-examples/flow.html)):

```python
builder = project.new_recipe("python")
builder.with_input("donor_features_raw")
builder.with_new_output_dataset("donor_features_scored", "postgres_broyhill")
builder.with_script("""
from dataiku import recipe
df = recipe.get_inputs_as_datasets()[0].get_dataframe()
# ... upgrade-prediction feature engineering ...
recipe.get_outputs_as_datasets()[0].write_with_schema(df)
""")
recipe = builder.create()
job = recipe.run()
```

---

## 4. Internal Algorithm Library

### 4.1 Visual ML Engines

DSS's visual ML supports two execution engines ([Algorithms reference](https://doc.dataiku.com/dss/latest/machine-learning/algorithms/index.html)):

| Engine | Backend | Use When |
|---|---|---|
| **In-memory Python** | scikit-learn, XGBoost, LightGBM, Keras | Data fits in RAM; most tabular use cases |
| **MLLib (Spark)** | Spark MLlib | Data doesn't fit in RAM; distributed training |

Historical support for H2O Sparkling Water and HPE Vertica ML engines has been de-emphasized in newer releases but remains via plugins.

### 4.2 Built-in Algorithms (Python Backend)

**Supervised — Regression + Classification:**
- Ridge / Lasso / Logistic Regression
- Decision Tree
- Random Forest
- Extra Trees
- Gradient Boosted Trees (sklearn GBM)
- **XGBoost** (1.5 default in DSS 13, 2.1 supported on Python 3.8+ code envs; XGBoost GPU support in DSS 14 built-in code env) ([DSS 13 Release notes](https://doc.dataiku.com/dss/latest/release_notes/13.html), [DSS 14 Release notes](https://doc.dataiku.com/dss/latest/release_notes/index.html))
- **LightGBM** (via plugin, now with categorical skip preprocessing option)
- SGD Classifier / Regressor
- K-Nearest Neighbors
- Artificial Neural Networks / Deep Learning (Keras/TensorFlow)
- **TabICL** (tabular foundation model, DSS 14)

**Unsupervised — Clustering:**
- K-Means, Mini-batch K-Means
- Ward Hierarchical
- Spectral Clustering
- DBSCAN
- Gaussian Mixture
- Isolation Forest (anomaly)

### 4.3 Custom Algorithms

The visual ML tool accepts any scikit-learn-compatible estimator ([Custom modeling KB](https://knowledge.dataiku.com/latest/ml-analytics/custom-models/concept-custom-modeling.html)):

**Contract:**
- Must implement `fit()` and `predict()`
- Classifiers additionally need `classes_` attribute and optional `predict_proba()`

**Injection paths:**
1. Project Python library (`{PROJECT_KEY}/lib/python/`)
2. Global Python library (instance-wide)
3. Code environment (any pip-installed package)
4. Plugin component (packaged, distributable)

### 4.4 MLflow Model Import

DSS imports MLflow models as first-class "Saved Models" with full explainability, monitoring, and governance ([MLflow limitations](https://doc.dataiku.com/dss/latest/mlops/mlflow-models/limitations.html)):

**Supported flavors (MLflow 2.22 / 3.10.1, Python 3.10):**

| Package | Binary | Multiclass | Regression |
|---|---|---|---|
| scikit-learn 1.0.2 | ✓ | ✓ | ✓ |
| XGBoost 1.7.6 | ✓ | ✓ | ✓ |
| LightGBM | ✓ | ✗ | ✓ |
| CatBoost 1.2.7 | ✓ | ✓ | ✓ |
| PyTorch 2.11 | ✓ | ✓ | ✓ |
| TensorFlow/Keras 2 | ✓ | ✓ | ✓ |
| ONNX 1.21 | ✓ | ✓ | ✓ |

**Not supported:** R MLflow models, Spark MLflow models, MLflow < 2.0.0.

Databricks Unity Catalog model import is available with lineage preservation as of Dec 2024 ([Community release notes](https://community.dataiku.com/discussion/39380/december-release-notes-deploy-anywhere-new-databricks-integrations-and-much-more)).

---

## 5. MLOps & Deployment Patterns

### 5.1 Deployment Modes

| Pattern | Target | Best For |
|---|---|---|
| **API Package → Static API Nodes** | Self-hosted API nodes behind LB | On-prem, tight latency SLA, cost predictability |
| **API Deployer → Kubernetes Infrastructure** | K8s (EKS/GKE/AKS, on-prem) | Autoscaling, containerized isolation |
| **Deploy Anywhere → SageMaker / Vertex AI / Azure ML** | Cloud-native serving | Cloud-committed shops, GPU inference |
| **Deploy Anywhere → Databricks / Snowflake Snowpark** | Warehouse-side scoring | Data-gravity architecture |
| **Batch Scoring Recipe** | Automation node | Nightly donor rescoring, no real-time need |

### 5.2 Model Registry & Governance

Every deployed model creates a **Saved Model** with versions, an active version pointer, and an evaluation history ([Model Registry](https://doc.dataiku.com/dss/11/governance/model-registry.html)). The **Model Evaluation Store** captures per-run metrics (AUC, precision, recall, MAE, etc.) and supports charting over time ([Dataiku Blog — Unified AI Ops](https://www.dataiku.com/blog/unified-ai-ops)).

### 5.3 Drift Analysis

Native drift analysis is built into every Saved Model ([Drift analysis docs](https://doc.dataiku.com/dss/latest/mlops/drift-analysis/index.html)):
- **Data drift** — statistical comparison of feature distributions between training and current data (KS, Chi-square, PSI).
- **Prediction drift** — distribution shift in model outputs.
- **Domain classifier drift** — trains an adversarial classifier to distinguish training from current data; p-value < 0.05 signals meaningful drift ([MLOps workshop](https://www.youtube.com/watch?v=j5zuzz47QmA)).

### 5.4 Scenarios & Retraining

Scenarios are DSS's orchestration primitive. Triggers: time-based, dataset-change, SQL, custom Python. Standard retrain pattern:

```
[Trigger: nightly 03:00]
  → [Rebuild feature dataset]
  → [Retrain saved model (new version)]
  → [Evaluate on holdout via Evaluation Recipe]
  → [If AUC > threshold: activate new version]
  → [If drift p<0.05: send email + Slack alert]
  → [Redeploy API package]
```

---

## 6. Integration Patterns for BroyhillGOP

### 6.1 Ingesting External Data (Postgres, S3, Files)

Native connections are configured once at instance level via `DSSConnection`. Typical connections for this environment:

| Source | Connection Type | Path |
|---|---|---|
| Hetzner Postgres 16 | `PostgreSQL` (JDBC) | `37.27.169.232:5432` — pushdown SQL recipes |
| Managed filesystem | `Filesystem` | Local paths for canary CSVs |
| S3 (donor exports, backups) | `S3` | IAM role or access key |
| SFTP (partner drops) | `SFTP` | For NCSBE/FEC delivery |
| SharePoint / OneDrive | `SharePoint Online` | Vendor spreadsheets |

**SQL pushdown:** SQL recipes execute inside Postgres (no data movement). Prepare/Join/Group recipes with SQL-compatible inputs are automatically pushed down via the "SQL" engine selector.

### 6.2 Integrating External ML Models

Three canonical patterns:

**A) Custom scikit-learn algorithm in visual ML** — for models you want DSS to train, feature-engineer, and monitor.

```python
# {PROJECT}/lib/python/donor_models.py
from sklearn.base import BaseEstimator, ClassifierMixin

class DonorUpgradeModel(BaseEstimator, ClassifierMixin):
    def __init__(self, hetzner_lookup=True, ...):
        ...
    def fit(self, X, y): ...
    def predict(self, X): ...
    def predict_proba(self, X): ...
    classes_ = [0, 1]
```

Import via visual ML → Design → Algorithms → Add custom model.

**B) MLflow model import** — for models trained outside DSS (Databricks, local Jupyter, Colab).

```python
import mlflow, dataikuapi
mlflow_ext = project.get_mlflow_extension()
sm = project.create_mlflow_pyfunc_model("donor_upgrade_external", "BINARY_CLASSIFICATION")
sm_version = sm.import_mlflow_version_from_path(
    version_id="v1",
    path="s3://bgop-models/donor_upgrade/2026-07-01/",
    code_env_name="py310_mlflow"
)
```

**C) External API endpoint** — for models served outside DSS (e.g., a self-hosted BentoML service or vendor API). Wrap in a Python recipe or an API Node **Python Function endpoint**.

### 6.3 Directory Layout for BGOP Integration

Recommended layout on the Design node:

```
DSS_DATA_DIR/
├── config/
│   └── projects/
│       ├── BGOP_DONOR_UPGRADE/         # donor upgrade prediction
│       ├── BGOP_INGESTION/             # E61 auto-intake mirror
│       └── BGOP_HEAT_TENSOR/           # E63 news→heat scoring
├── code-envs/
│   └── python/
│       ├── py310_ml_stable/            # sklearn 1.0.2, xgboost 1.7.6
│       └── py310_bgop_prod/            # dbt-postgres, geocodio, sqlalchemy
├── managed/                            # managed filesystem datasets
├── plugins/
│   └── dev/
│       └── bgop-hetzner-connector/     # custom plugin recipes
└── api-services-packages/              # generated .zip API bundles
```

### 6.4 Standard Integration Handshake

For every new external model/dataset consumed by DSS:

1. **Register a Connection** (idempotent via `client.create_sql_connection(...)`).
2. **Declare Dataset** (`project.create_sql_table_dataset(...)` or `new_managed_dataset`).
3. **Freeze schema** using explicit `set_schema()` — never rely on inference in a production flow.
4. **Version the code environment** — pin packages, tag with Git SHA.
5. **Wire retraining scenario** with drift trigger and a manual-approval step (E62-style human gate).
6. **Publish API endpoint** through API Designer, then push to API Deployer infrastructure.

---

## 7. Known Limitations Relevant to BGOP

| Limitation | Impact | Workaround |
|---|---|---|
| No R MLflow / Spark MLflow model import | Cannot bring in some external artifacts | Use custom Python wrapper or pyfunc |
| Java-optimized scoring not usable for row-level explanations | Explanation endpoints slower | Reserve explanations for Case Review UI only |
| API Node parallelism configured **per endpoint** not globally | Ops overhead per service | Standardize `pool` JSON template |
| XGBoost version pinning during migrations | Existing models can break on major upgrades | Retrain or use migration tool ([DSS 13 notes](https://doc.dataiku.com/dss/latest/release_notes/13.html)) |
| Enterprise pricing is opaque; per-user seats | Hard to model long-term cost | See §8 comparison document |
| Vendor lock-in on the visual Flow serialization | Migration off DSS is non-trivial | Enforce discipline: keep transformation logic in SQL/Python that can be re-hosted |

---

## 8. Companion Documents

- **`02_dataiku_vs_custom_mlops_dashboard.md`** — Side-by-side comparative dashboard against a custom MLflow + BentoML + Feast + Seldon stack, scored for the BGOP fundraising use case.
- **`03_dataiku_api_node_performance_tuning.md`** — Java scoring enablement, pool sizing formula, K8s horizontal scaling procedure, latency/memory/timeout troubleshooting.

---

## Primary Sources

- [Dataiku Public REST API reference](https://doc.dataiku.com/dss/api/latest/rest/)
- [dataikuapi Python client reference](https://doc.dataiku.com/dss/11/python-api/dataikuapi-reference.html)
- [Developer Guide — API reference](https://developer.dataiku.com/latest/api-reference/python/index.html)
- [dataiku-api-client-python on GitHub](https://github.com/dataiku/dataiku-api-client-python)
- [The Flow](https://doc.dataiku.com/dss/latest/flow/index.html)
- [Handling of schemas by recipes](https://doc.dataiku.com/dss/latest/schemas/recipes.html)
- [Algorithms reference](https://doc.dataiku.com/dss/latest/machine-learning/algorithms/index.html)
- [MLflow model limitations](https://doc.dataiku.com/dss/latest/mlops/mlflow-models/limitations.html)
- [API Node & API Deployer](https://doc.dataiku.com/dss/latest/apinode/index.html)
- [High availability and scalability](https://doc.dataiku.com/dss/latest/apinode/operations/ha-deployment.html)
- [MLOps architecture concept](https://knowledge.dataiku.com/latest/deploy/aiops-overview/concept-dataiku-architecture.html)
- [InfoWorld review with pricing snapshot](https://www.infoworld.com/article/2265977/dataiku-review-data-science-fit-for-the-enterprise.html)
