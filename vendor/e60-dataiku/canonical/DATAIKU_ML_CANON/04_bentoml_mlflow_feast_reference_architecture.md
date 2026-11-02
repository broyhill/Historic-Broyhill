# BentoML + MLflow + Feast — Reference Architecture

**For:** BroyhillGOP donor-intelligence platform
**Truth source:** Hetzner PostgreSQL 16 at `37.27.169.232:5432`
**Companion to:** `01_dataiku_technical_audit.md`, `02_dataiku_vs_custom_mlops_dashboard.md`, `03_dataiku_api_node_performance_tuning.md`
**Doctrine anchors:** `broyhillgop-doctrine`, `database-canary-check`, `canonical-donor-join-keys`, `donor-centric-architecture`, `authorization-protocol`, `hetzner-server-safety`

---

## 1. Purpose & Scope

This document defines the reference architecture for running the BGOP MLOps stack **without Dataiku**, on the existing Hetzner infrastructure, using three OSS components:

| Layer | Tool | Role |
|---|---|---|
| Feature store | **Feast** | Canonical feature definitions, offline (Postgres) + online (Redis) serving, versioned |
| Experiment tracking + model registry | **MLflow** | Training runs, model artifacts, versioning, stage transitions, governance schema |
| Model serving | **BentoML** | Python-native real-time inference API, K8s deployable, matches BGOP FastAPI patterns |

**Non-goals:** replacing the Hetzner Postgres truth source, replacing the LP decision engine (E60), replacing the E63 heat tensor pipeline. Those remain code-first in the existing repo.

**Scope boundary:** This stack serves the donor upgrade prediction model, the two-tower recommender (E11-E25 moat), and future scoring endpoints (contactability, faction assignment, ask amount elasticity). It does **not** serve heavy batch jobs (that's Prefect/Dagster) or LLM inference (that lives elsewhere).

---

## 2. Topology on Hetzner

![BGOP truth source flow — Hetzner → Feast → BentoML](diagrams/truth_source_flow.png)

**Figure 2.1** — Full-stack layered view. Four bands top-to-bottom: clients, BentoML serving, Feast + MLflow, and the Hetzner truth source. Every cross-layer arrow joins on `cluster_id`. The sacred canary is verified before/after every migration, on every BentoML pod boot, and hourly via Prefect. See the [companion glossary](#12-glossary--bgop-specific-terms) for any term.

Compact text summary for terminal readers:

```
CLIENTS  →  Hetzner LB11  →  3x BentoML pods  →  Feast online  →  feast.* schema
                                    ↓                                     ↑
                             ml_audit writes             materialize from core.*
                                    ↓                                     ↑
                        Hetzner Postgres 16  (truth source, 37.27.169.232:5432)
                        raw.*  core.*  brain.*  feast.*  mlflow.*  ml_audit.*  ml_gov.*

MLflow tracking server on hetzner-ml-01; artifacts in Hetzner Object Storage (S3-compat).
Model promotion to Production gated by 'I AUTHORIZE THIS ACTION' exact-phrase per authorization-protocol.
```

**Cost floor** (all Hetzner, us-east region equivalents):

| Component | Spec | Monthly |
|---|---|---|
| hetzner-ml-01 (MLflow + Feast registry + Redis) | CX41 4 vCPU / 16 GB | ~$35 |
| 3× bento-api-XX (BentoML pods) | CX41 4 vCPU / 16 GB each | ~$100 |
| Hetzner LB11 | L7 load balancer | ~$6 |
| Object storage (MLflow artifacts, Feast offline joined tables) | Hetzner Object Storage 100 GB | ~$5 |
| Existing hetzner-db-01 | Already provisioned | $0 |
| **Total** | | **~$146/mo → ~$1,750/yr** |

---

## 3. Postgres Schema Additions

The Hetzner truth source gains four new namespaces alongside `raw.*`, `core.*`, `brain.*`. Every table sits in its own schema so backup, permissions, and canary discipline stay clean.

```sql
-- Run once, with I AUTHORIZE THIS ACTION gate per authorization-protocol
-- Verify sacred canary before AND after per database-canary-check

CREATE SCHEMA IF NOT EXISTS feast    AUTHORIZATION bgop_mlops;
CREATE SCHEMA IF NOT EXISTS mlflow   AUTHORIZATION bgop_mlops;
CREATE SCHEMA IF NOT EXISTS ml_audit AUTHORIZATION bgop_mlops;
CREATE SCHEMA IF NOT EXISTS ml_gov   AUTHORIZATION bgop_mlops;

-- Extensions (pgvector for two-tower donor embeddings, plus uuid)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3.1 Schema `feast.*`

Feast auto-creates its own tables when using the Postgres online store, but we pin the schema to keep isolation clean.

```yaml
# feature_repo/feature_store.yaml
project: bgop_features
registry:
  registry_type: sql
  path: postgresql+psycopg2://bgop_mlops:${FEAST_DB_PW}@37.27.169.232:5432/bgop
provider: local
offline_store:
  type: postgres
  host: 37.27.169.232
  port: 5432
  database: bgop
  db_schema: core        # historical features join against core.* directly
  user: bgop_mlops_ro    # READ-ONLY role for offline
  password: ${FEAST_RO_PW}
online_store:
  type: postgres
  host: 37.27.169.232
  port: 5432
  database: bgop
  db_schema: feast
  user: bgop_mlops
  password: ${FEAST_DB_PW}
  vector_enabled: true   # pgvector for two-tower embeddings
  vector_length: 2550    # per donor-centric-architecture spec
entity_key_serialization_version: 3
```

Feast will create in the `feast` schema:
- `feast_metadata` — registry state
- `<feature_view_name>` — one online table per feature view
- Optionally, pgvector-indexed tables when `vector_enabled: true`

Source: [Feast Postgres online store docs](https://docs.feast.dev/reference/online-stores/postgres).

### 3.2 Schema `mlflow.*`

MLflow uses Postgres as backend store. Configure the tracking server with:

```
--backend-store-uri postgresql://bgop_mlops:${MLFLOW_DB_PW}@37.27.169.232:5432/bgop?options=-c%20search_path%3Dmlflow
--default-artifact-root s3://bgop-mlflow-artifacts/
--host 0.0.0.0 --port 5000 --workers 4
```

MLflow creates ~20 tables: `experiments`, `runs`, `metrics`, `params`, `tags`, `registered_models`, `model_versions`, `model_version_tags`, etc. Keep them all in `mlflow` schema for backup isolation.

### 3.3 Schema `ml_audit.*` — Prediction Audit Log

Every real-time prediction call from BentoML writes here. This is BGOP-specific — MLflow does not audit inference calls, only training runs.

```sql
CREATE TABLE ml_audit.prediction_log (
    prediction_id      uuid       PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_name      text       NOT NULL,
    model_name         text       NOT NULL,
    model_version      text       NOT NULL,           -- MLflow model version
    candidate_id       text       NOT NULL,           -- silo enforcement
    donor_pseudonym_id text,                          -- per donor-centric-architecture
    rnc_regid          text,                          -- optional, only when auth allows PII
    cluster_id         bigint,                        -- canonical join key
    request_features   jsonb      NOT NULL,
    prediction         jsonb      NOT NULL,           -- {"proba": 0.82, "class": 1}
    explanation        jsonb,                         -- optional SHAP
    latency_ms         int        NOT NULL,
    served_by_host     text       NOT NULL,           -- which bento-api-XX
    served_at          timestamptz NOT NULL DEFAULT now(),
    request_source     text                           -- portal, agent, cron, etc.
);

CREATE INDEX idx_predlog_candidate_time
    ON ml_audit.prediction_log (candidate_id, served_at DESC);
CREATE INDEX idx_predlog_model_time
    ON ml_audit.prediction_log (model_name, model_version, served_at DESC);
CREATE INDEX idx_predlog_cluster
    ON ml_audit.prediction_log (cluster_id) WHERE cluster_id IS NOT NULL;
```

### 3.4 Schema `ml_gov.*` — Model Governance

Human-facing governance layer that MLflow's registry alone doesn't provide (model cards, sign-offs, scope constraints).

```sql
CREATE TABLE ml_gov.model_card (
    model_name          text     PRIMARY KEY,
    purpose             text     NOT NULL,
    training_data_query text     NOT NULL,         -- SQL that reproduces training set
    training_snapshot   text     NOT NULL,         -- pg_dump SHA or snapshot ref
    feature_hash        text     NOT NULL,         -- hash of feature list + versions
    intended_scope      jsonb    NOT NULL,         -- {"race_type": ["NCGA","statewide"], "office_class": [...]}
    prohibited_scope    jsonb,                     -- explicit no-fly list
    approved_by         text     NOT NULL,
    approved_at         timestamptz NOT NULL,
    superseded_by       text,
    canary_verified_at  timestamptz NOT NULL,      -- canary 372171 = $332,631.30 confirmed
    doctrine_refs       text[]                     -- e.g. ARRAY['donor-centric-architecture', 'race-relational-scoring']
);

CREATE TABLE ml_gov.approval_event (
    id            bigserial PRIMARY KEY,
    model_name    text NOT NULL,
    model_version text NOT NULL,
    action        text NOT NULL,        -- 'promoted_to_staging', 'promoted_to_production', 'archived'
    actor         text NOT NULL,        -- who did it
    exact_phrase  text NOT NULL,        -- 'I AUTHORIZE THIS ACTION' per authorization-protocol
    reason        text,
    happened_at   timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Feast — Feature Store Configuration

### 4.1 Repo Layout

```
bgop-feature-store/
├── feature_store.yaml
├── entities.py
├── data_sources.py
├── feature_views/
│   ├── donor_recency.py
│   ├── donor_capacity.py
│   ├── donor_grades.py             # Triple Grading System per donor-grading-system
│   ├── donor_contactability.py     # per contactability-tiering
│   ├── donor_faction.py            # per donor-faction-assignment
│   ├── donor_embedding.py          # 2550-dim vector per donor-centric-architecture
│   ├── candidate_office_class.py   # per race-relational-scoring
│   └── heat_tensor.py              # per news-driven-heat-quantification
├── on_demand/
│   └── odfv_upgrade_features.py    # on-demand transforms for real-time
└── tests/
    └── canary_features.py          # confirms cluster 372171 features unchanged
```

### 4.2 Canonical Entities (Aligned with `canonical-donor-join-keys`)

```python
# entities.py
from feast import Entity, ValueType

donor = Entity(
    name="donor",
    join_keys=["cluster_id"],          # primary canonical key
    value_type=ValueType.INT64,
    description="Canonical donor spine. cluster_id is the sacred lookup key. "
                "rnc_regid is a secondary key for RNC voter-file matches.",
)

candidate = Entity(
    name="candidate",
    join_keys=["candidate_id"],        # licensed subscriber
    value_type=ValueType.STRING,
)

race = Entity(
    name="race",
    join_keys=["race_id"],             # office × district × cycle
    value_type=ValueType.STRING,
)
```

**Rule:** Every feature view MUST include `cluster_id` in its join keys. Any feature keyed only by `rnc_regid` or by raw `donor_name` is a doctrine violation and blocks merge (per `canonical-donor-join-keys`).

### 4.3 Sample Feature View — Donor Grades

```python
# feature_views/donor_grades.py
from datetime import timedelta
from feast import FeatureView, Field, PostgreSQLSource
from feast.types import String, Float32, Int32
from entities import donor

donor_grades_source = PostgreSQLSource(
    name="donor_grades_snapshot",
    query="""
        SELECT
            cluster_id,
            donor_grade_state,
            donor_grade_district,
            donor_grade_county,
            composite_grade,
            intensity_score,
            level_preference,
            grade_computed_at AS event_timestamp
        FROM core.donor_grades_hist
    """,
    timestamp_field="event_timestamp",
)

donor_grades_fv = FeatureView(
    name="donor_grades",
    entities=[donor],
    ttl=timedelta(days=90),
    schema=[
        Field(name="donor_grade_state",    dtype=String),
        Field(name="donor_grade_district", dtype=String),
        Field(name="donor_grade_county",   dtype=String),
        Field(name="composite_grade",      dtype=String),
        Field(name="intensity_score",      dtype=Int32),
        Field(name="level_preference",     dtype=String),
    ],
    source=donor_grades_source,
    tags={
        "doctrine": "donor-grading-system",
        "canonical_join": "cluster_id",
        "silo_scope": "cross_candidate",  # grades are donor-intrinsic, not per-candidate
    },
)
```

### 4.4 Two-Tower Donor Embedding (pgvector-backed)

```python
# feature_views/donor_embedding.py
from feast import FeatureView, Field, PostgreSQLSource
from feast.types import Array, Float32
from entities import donor

donor_embedding_source = PostgreSQLSource(
    name="donor_embedding_snapshot",
    query="""
        SELECT
            cluster_id,
            embedding,                     -- pgvector column, 2550 dims
            embedding_version,
            embedding_computed_at AS event_timestamp
        FROM core.donor_embedding_hist
    """,
    timestamp_field="event_timestamp",
)

donor_embedding_fv = FeatureView(
    name="donor_embedding",
    entities=[donor],
    ttl=timedelta(days=30),
    schema=[
        Field(
            name="embedding",
            dtype=Array(Float32),
            vector_index=True,           # enables pgvector ANN
            vector_length=2550,          # per donor-centric-architecture
        ),
        Field(name="embedding_version", dtype=String),
    ],
    source=donor_embedding_source,
    online=True,
    tags={
        "doctrine": "donor-centric-architecture",
        "canonical_join": "cluster_id",
    },
)
```

At scoring time, BentoML fetches the donor's embedding via `store.get_online_features(...)` and computes dot-product against the candidate tower (either in-memory FAISS for hot candidates, or a Postgres ANN query for cold ones).

### 4.5 Materialization Cadence

```bash
# Historical backfill (one-time per feature view)
feast apply
feast materialize-incremental $(date -u +%Y-%m-%dT%H:%M:%S)

# Cron (via Prefect deployment) — every 15 minutes for hot views, hourly for cold
*/15 * * * *  bgop_mlops   cd /opt/bgop/feature-store && feast materialize-incremental $(date -u +%Y-%m-%dT%H:%M:%S) --views donor_recency donor_capacity heat_tensor
0    * * * *  bgop_mlops   cd /opt/bgop/feature-store && feast materialize-incremental $(date -u +%Y-%m-%dT%H:%M:%S) --views donor_grades donor_faction donor_embedding
```

The 15-minute cadence is the practical floor for Feast Postgres online materialization at BGOP data volume. If E63 heat tensor requires the 60-second tick promised by `news-driven-heat-quantification`, bypass Feast for heat features and read directly from a Redis Streams topic that E63 publishes — Feast is not the right tool for sub-minute cadence.

---

## 5. MLflow — Tracking & Registry

### 5.1 Tracking Server Deployment

Run on `hetzner-ml-01` behind a reverse proxy. Systemd unit:

```ini
# /etc/systemd/system/mlflow-server.service
[Unit]
Description=MLflow Tracking Server
After=network.target

[Service]
Type=simple
User=bgop_mlops
Environment="AWS_ACCESS_KEY_ID=..."           # for Hetzner Object Storage (S3-compatible)
Environment="AWS_SECRET_ACCESS_KEY=..."
Environment="MLFLOW_S3_ENDPOINT_URL=https://nbg1.your-objectstorage.com"
ExecStart=/opt/bgop/mlops-venv/bin/mlflow server \
    --backend-store-uri postgresql://bgop_mlops:${MLFLOW_DB_PW}@37.27.169.232:5432/bgop?options=-c%20search_path%3Dmlflow \
    --default-artifact-root s3://bgop-mlflow-artifacts/ \
    --host 127.0.0.1 --port 5000 \
    --workers 4 \
    --gunicorn-opts "--timeout 120"
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Front with Nginx + BGOP OIDC auth (candidate portal uses the same SSO):

```nginx
# /etc/nginx/sites-enabled/mlflow
server {
    listen 443 ssl http2;
    server_name mlflow.bgop.internal;

    ssl_certificate     /etc/letsencrypt/live/bgop.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bgop.internal/privkey.pem;

    auth_request /_oauth2/auth;
    error_page 401 = @error401;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Training Run Pattern

Every training run must:
1. Verify sacred canary before touching training data
2. Compute a training data hash
3. Log full lineage to MLflow
4. Register the model with a governance-ready `description` and tags
5. NOT auto-promote to production — that requires the exact-phrase authorization

```python
# scripts/train_donor_upgrade.py
import hashlib, json, mlflow, mlflow.xgboost, pandas as pd, xgboost as xgb
from feast import FeatureStore
from sqlalchemy import create_engine, text
from bgop_common.canary import verify_canary   # BGOP-internal library

# ── 1. Canary check (per database-canary-check) ────────────────────────────
engine = create_engine(os.environ["BGOP_PG_RO_URL"])
verify_canary(engine)   # raises if cluster 372171 ≠ 147 txns / $332,631.30

# ── 2. Build training set via Feast historical retrieval ───────────────────
store = FeatureStore(repo_path="/opt/bgop/feature-store")
entity_df = pd.read_sql(text("""
    SELECT
        cluster_id,
        candidate_id,
        race_id,
        upgraded_in_next_90d AS label,
        event_timestamp
    FROM core.donor_upgrade_labels
    WHERE event_timestamp < '2026-06-01'
"""), engine)

training_df = store.get_historical_features(
    entity_df=entity_df,
    features=[
        "donor_grades:composite_grade",
        "donor_grades:intensity_score",
        "donor_recency:days_since_last_gift",
        "donor_recency:gifts_last_365d",
        "donor_capacity:capacity_tier",
        "donor_capacity:lifetime_political_giving",
        "donor_faction:faction_id",
        "donor_contactability:tier",
        # embedding is used by the two-tower model, not this simpler upgrade model
    ],
).to_df()

# ── 3. Hash the training data for lineage ──────────────────────────────────
training_hash = hashlib.sha256(
    pd.util.hash_pandas_object(training_df, index=True).values.tobytes()
).hexdigest()

# ── 4. MLflow run ──────────────────────────────────────────────────────────
mlflow.set_tracking_uri("https://mlflow.bgop.internal")
mlflow.set_experiment("donor_upgrade_prediction")

with mlflow.start_run(run_name=f"upgrade_{pd.Timestamp.utcnow():%Y%m%d_%H%M}") as run:
    mlflow.log_param("training_hash", training_hash)
    mlflow.log_param("canary_verified", True)
    mlflow.log_param("feast_repo_sha", os.environ["FEAST_REPO_GIT_SHA"])
    mlflow.set_tags({
        "doctrine.canonical_join": "cluster_id",
        "doctrine.silo_scope":     "cross_candidate",
        "doctrine.refs":           "donor-centric-architecture,donor-grading-system,race-relational-scoring",
        "bgop.ecosystem":          "E01",
    })

    X = training_df.drop(columns=["cluster_id", "candidate_id", "race_id",
                                   "label", "event_timestamp"])
    y = training_df["label"]

    model = xgb.XGBClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.05,
        eval_metric="auc", tree_method="hist",
    )
    model.fit(X, y)

    mlflow.log_metric("train_auc", auc_score(model, X, y))
    # Log holdout metrics, calibration, etc.

    mlflow.xgboost.log_model(
        xgb_model=model,
        artifact_path="model",
        registered_model_name="donor_upgrade",
        input_example=X.iloc[[0]],
        signature=mlflow.models.infer_signature(X, model.predict_proba(X)),
    )

    # DO NOT auto-transition to Production — governance gate follows
    print(f"Registered as candidate for donor_upgrade, run_id={run.info.run_id}")
```

### 5.3 Promotion Gate

Promotion `Staging → Production` requires the authorization protocol. Enforced by a small script:

```python
# scripts/promote_model.py
import sys, mlflow
from bgop_common.auth import require_exact_phrase

if __name__ == "__main__":
    model_name, version, actor = sys.argv[1], sys.argv[2], sys.argv[3]
    require_exact_phrase(prompt=f"Promote {model_name} v{version} to Production")
    # ↑ blocks unless user types "I AUTHORIZE THIS ACTION"

    client = mlflow.MlflowClient(tracking_uri="https://mlflow.bgop.internal")
    client.transition_model_version_stage(
        name=model_name, version=version,
        stage="Production", archive_existing_versions=True,
    )
    # Write ml_gov.approval_event
    log_approval_event(model_name, version, "promoted_to_production", actor, "I AUTHORIZE THIS ACTION")
```

### 5.4 Model Governance Sync

After every promotion, sync `ml_gov.model_card` from MLflow tags. A weekly Prefect flow reconciles both directions to catch tag drift.

---

## 6. BentoML — Real-Time Serving

### 6.1 Service Definition

One BentoML service per model. Each service is a Python module in the `bgop-serving` repo.

```
bgop-serving/
├── bentofile.yaml
├── requirements.txt
├── src/
│   ├── common/
│   │   ├── audit.py           # writes to ml_audit.prediction_log
│   │   ├── silo.py            # candidate_id enforcement middleware
│   │   ├── canary.py          # startup-time canary confirmation
│   │   └── feast_client.py    # shared FeatureStore handle
│   ├── donor_upgrade/
│   │   └── service.py
│   ├── two_tower/
│   │   └── service.py
│   ├── contactability/
│   │   └── service.py
│   └── ask_amount/
│       └── service.py
└── tests/
    ├── test_canary_startup.py
    └── test_silo_enforcement.py
```

### 6.2 Donor Upgrade Service Example

```python
# src/donor_upgrade/service.py
import bentoml, numpy as np, pandas as pd
from bentoml.io import JSON
from pydantic import BaseModel, Field
from typing import Literal, Optional
from common.feast_client import store
from common.audit import log_prediction
from common.silo import enforce_candidate_silo
from common.canary import verify_canary_at_startup

verify_canary_at_startup()   # process refuses to start if canary is off

# Pull the production model from MLflow at build time
donor_upgrade_runner = bentoml.mlflow.import_model(
    "donor_upgrade",
    "models:/donor_upgrade/Production",
).to_runner()

svc = bentoml.Service(
    "donor_upgrade",
    runners=[donor_upgrade_runner],
)

class PredictRequest(BaseModel):
    cluster_id: int      = Field(..., description="Canonical donor spine key")
    candidate_id: str    = Field(..., description="Licensed subscriber candidate")
    race_id: str
    request_source: Literal["portal", "agent", "cron"] = "portal"

class PredictResponse(BaseModel):
    prediction:   int
    probability:  float
    model_version: str
    explanation:  Optional[dict] = None

@svc.api(input=JSON(pydantic_model=PredictRequest),
         output=JSON(pydantic_model=PredictResponse))
async def predict(req: PredictRequest, ctx: bentoml.Context) -> PredictResponse:
    t0 = pd.Timestamp.utcnow()

    # 1. Silo enforcement — reject cross-candidate lookups
    caller_candidate = enforce_candidate_silo(ctx.request, req.candidate_id)

    # 2. Online feature fetch from Feast (Postgres online store)
    features = store.get_online_features(
        features=[
            "donor_grades:composite_grade",
            "donor_grades:intensity_score",
            "donor_recency:days_since_last_gift",
            "donor_recency:gifts_last_365d",
            "donor_capacity:capacity_tier",
            "donor_capacity:lifetime_political_giving",
            "donor_faction:faction_id",
            "donor_contactability:tier",
        ],
        entity_rows=[{"cluster_id": req.cluster_id}],
    ).to_dict()

    X = pd.DataFrame(features).drop(columns=["cluster_id"])

    # 3. Inference
    probas = await donor_upgrade_runner.predict_proba.async_run(X)
    proba_upgrade = float(probas[0][1])
    prediction = int(proba_upgrade >= 0.5)

    # 4. Audit log
    latency_ms = int((pd.Timestamp.utcnow() - t0).total_seconds() * 1000)
    log_prediction(
        endpoint_name="donor_upgrade",
        model_name="donor_upgrade",
        model_version=donor_upgrade_runner.model_info.version,
        candidate_id=req.candidate_id,
        cluster_id=req.cluster_id,
        request_features=X.iloc[0].to_dict(),
        prediction={"proba": proba_upgrade, "class": prediction},
        latency_ms=latency_ms,
        request_source=req.request_source,
    )

    return PredictResponse(
        prediction=prediction,
        probability=proba_upgrade,
        model_version=donor_upgrade_runner.model_info.version,
    )
```

### 6.3 `bentofile.yaml`

```yaml
service: "src.donor_upgrade.service:svc"
labels:
  owner: bgop-mlops
  doctrine: donor-centric-architecture,donor-grading-system
include:
  - "src/**/*.py"
python:
  requirements_txt: "requirements.txt"
  lock_packages: true
docker:
  distro: debian
  python_version: "3.11"
  system_packages:
    - libpq-dev
  env:
    BGOP_PG_URL:      "$BGOP_PG_URL"          # supplied at container runtime
    BGOP_PG_RO_URL:   "$BGOP_PG_RO_URL"
    FEAST_REPO_PATH:  "/opt/bgop/feature-store"
    MLFLOW_TRACKING_URI: "https://mlflow.bgop.internal"
```

### 6.4 Build & Deploy

```bash
# On CI runner (GitHub Actions)
bentoml build
bentoml containerize donor_upgrade:latest --image-tag registry.bgop.internal/donor_upgrade:$(git rev-parse --short HEAD)
docker push registry.bgop.internal/donor_upgrade:$(git rev-parse --short HEAD)

# Trigger K8s rollout (or plain SSH + docker-compose on bento-api-XX)
kubectl set image deployment/donor-upgrade donor-upgrade=registry.bgop.internal/donor_upgrade:$SHA -n bgop-ml
```

### 6.5 Silo Enforcement Middleware

```python
# src/common/silo.py
import jwt
from fastapi import HTTPException, Request
from bgop_common.jwt_keys import BGOP_JWT_PUBLIC_KEY

def enforce_candidate_silo(request: Request, requested_candidate_id: str) -> str:
    """
    Reject cross-candidate access. Per candidate-silo-protections.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = auth.removeprefix("Bearer ")
    try:
        claims = jwt.decode(token, BGOP_JWT_PUBLIC_KEY, algorithms=["RS256"])
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    caller = claims.get("candidate_id")
    role   = claims.get("role")

    # super_admin and ncrdc_admin can read across candidates (per auth-rbac)
    if role in ("super_admin", "ncrdc_admin"):
        return caller

    if caller != requested_candidate_id:
        raise HTTPException(403,
            f"Silo violation: caller={caller} requested={requested_candidate_id}")

    return caller
```

### 6.6 Request Path (Zoomed)

![BentoML request path — donor-upgrade-svc single prediction](diagrams/bentoml_request_path.png)

**Figure 6.1** — Sequence flow for one hot-path prediction. Six lifelines from left to right: candidate portal, Hetzner LB11, BentoML pod, Feast online, MLflow runner (loaded in-process at build time), and the `ml_audit.prediction_log` table. Every guardrail (canary, silo, TTL, model version pinning, audit) is annotated at the exact step where it fires.

Key properties visible in the diagram:

- **Startup canary check** runs once at boot — the pod refuses to start if `cluster_id = 372171` does not resolve to 147 txns / $332,631.30 (per `database-canary-check`).
- **Silo enforcement** runs before any feature lookup — rejects with HTTP 403 if the JWT's `candidate_id` does not match the request's `candidate_id` (bypass for `super_admin` / `ncrdc_admin` per `auth-rbac`).
- **Model version is pinned at build time**, never resolved at runtime — prevents surprise Production promotions from silently changing behavior mid-flight.
- **Audit insert is fire-and-forget**, adding zero to the response latency budget but guaranteeing every prediction lands in `ml_audit.prediction_log`.
- **Total server-side p95 target: ~35 ms**, well under the 100 ms endpoint SLA and the 5000 ms client-side timeout.

### 6.7 Startup Canary

```python
# src/common/canary.py
import os, sys
from sqlalchemy import create_engine, text

def verify_canary_at_startup():
    """
    Per database-canary-check. Refuses to start if the sacred canary is off.
    """
    engine = create_engine(os.environ["BGOP_PG_RO_URL"])
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT COUNT(*) AS n_txn,
                   SUM(amount)::numeric(14,2) AS total
            FROM core.donor_transactions
            WHERE cluster_id = 372171
              AND primary_email = 'ed@broyhill.net'
        """)).one()

    if row.n_txn != 147 or float(row.total) != 332631.30:
        sys.stderr.write(
            f"CANARY FAILURE: expected 147 txns / $332,631.30, "
            f"got {row.n_txn} txns / ${row.total}. Refusing to start.\n"
        )
        sys.exit(2)
```

---

## 7. Deployment Topology (K8s Manifests)

If you deploy BentoML to Kubernetes (recommended when >3 instances or when Prefect flows want ephemeral GPU pods for the two-tower training).

```yaml
# k8s/donor-upgrade-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: donor-upgrade
  namespace: bgop-ml
  labels:
    app: donor-upgrade
    bgop.doctrine: donor-centric-architecture
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  selector:
    matchLabels: { app: donor-upgrade }
  template:
    metadata:
      labels: { app: donor-upgrade }
    spec:
      containers:
      - name: donor-upgrade
        image: registry.bgop.internal/donor_upgrade:$SHA
        ports:
        - containerPort: 3000
        env:
        - name: BGOP_PG_URL
          valueFrom: { secretKeyRef: { name: bgop-pg, key: url } }
        - name: BGOP_PG_RO_URL
          valueFrom: { secretKeyRef: { name: bgop-pg-ro, key: url } }
        - name: MLFLOW_TRACKING_URI
          value: "https://mlflow.bgop.internal"
        resources:
          requests: { cpu: "500m", memory: "2Gi" }
          limits:   { cpu: "2",    memory: "4Gi" }
        livenessProbe:
          httpGet: { path: /livez, port: 3000 }
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet: { path: /readyz, port: 3000 }
          initialDelaySeconds: 15
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: donor-upgrade
  namespace: bgop-ml
spec:
  selector: { app: donor-upgrade }
  ports: [ { port: 80, targetPort: 3000, name: http } ]
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: donor-upgrade
  namespace: bgop-ml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: donor-upgrade
  minReplicas: 3
  maxReplicas: 12
  metrics:
  - type: Resource
    resource: { name: cpu,    target: { type: Utilization, averageUtilization: 65 } }
  - type: Resource
    resource: { name: memory, target: { type: Utilization, averageUtilization: 75 } }
```

For non-K8s (plain Docker on 3× Hetzner nodes), use `docker-compose` + Nginx + `keepalived` for VIP failover. The BentoML runtime is stateless; scaling horizontally is trivial as long as Feast and MLflow are shared.

---

## 8. Observability

| Signal | Tool | Where It Lands |
|---|---|---|
| Prediction latency, error rate | Prometheus (BentoML built-in `/metrics`) | Grafana on hetzner-ml-01 |
| Feature freshness | Feast metrics + custom Prefect check | Grafana + Postgres `ml_audit.feature_freshness` |
| Model drift (Evidently) | Nightly Prefect flow | Reports in S3 + summary in `ml_gov.drift_report` |
| Training runs | MLflow UI | https://mlflow.bgop.internal |
| Prediction audit trail | `ml_audit.prediction_log` | Postgres — queryable directly |
| Silo violations | Alert if 4xx from `common.silo` spikes | Grafana alert → PagerDuty |
| Canary status | Startup log + hourly Prefect check | Postgres `ml_audit.canary_check` + Slack |

**Grafana dashboards to build:**
1. "Model performance last 24 h" — p50/p95/p99 latency, throughput, error rate per model
2. "Feast freshness" — max staleness per feature view
3. "Prediction distribution drift" — hourly histograms of prediction probabilities per model
4. "Silo integrity" — 403 count by caller `candidate_id`
5. "MLflow registry health" — model versions by stage, days-since-last-training per model

---

## 9. Cutover Plan (If Migrating From Current Stack)

![BGOP MLOps cutover — 12-week phase plan](diagrams/cutover_phases.png)

**Figure 9.1** — 12-week migration timeline. Each phase is a swimlane; the colored bar shows the week range; work items sit alongside. The bottom row marks the mandatory gates: yellow circles are sacred canary checks (`database-canary-check`), purple diamonds are exact-phrase authorization events (`authorization-protocol`). Week 6 has two gates in the same week — the promotion authorization, then a cutover canary before the portal flip.


### Phase 0 — Read-Only Foundations (Week 1)
- Provision hetzner-ml-01
- Deploy MLflow tracking server against Postgres `mlflow` schema (read-only initial state)
- Deploy Feast registry pointing at Postgres `feast` schema (empty)
- Verify sacred canary before AND after schema creation (per `database-canary-check`)

### Phase 1 — Feature Layer (Week 2-3)
- Define `donor_grades`, `donor_recency`, `donor_capacity`, `donor_contactability`, `donor_faction` feature views
- Run `feast apply` and initial `feast materialize`
- Verify online store returns expected feature values for `cluster_id = 372171` (canary-adjacent check)

### Phase 2 — First Model End-to-End (Week 4-5)
- Retrain donor upgrade prediction against Feast historical features
- Log to MLflow, register as `donor_upgrade v1`
- Build BentoML service, containerize, deploy to one bento-api-01 (no LB yet)
- Shadow-mode: run alongside existing scoring, log both predictions to `ml_audit.prediction_log`, compare

### Phase 3 — Production Cutover (Week 6)
- Deploy 3× bento-api-XX behind Hetzner LB11
- Flip candidate portal to call `donor-upgrade.bgop.internal` instead of current endpoint
- Monitor for 1 week under shadow, then decommission old endpoint (with `I AUTHORIZE THIS ACTION` gate)

### Phase 4 — Second Model + Two-Tower (Week 7-10)
- Add `donor_embedding` feature view with pgvector
- Train two-tower recommender per `donor-centric-architecture`
- Deploy `two-tower-svc` BentoML service

### Phase 5 — Governance Hardening (Week 11-12)
- Wire `ml_gov.model_card` + `ml_gov.approval_event`
- Build Grafana dashboards
- Document runbook and hand to on-call rotation

---

## 10. Known Gotchas

| Gotcha | Mitigation |
|---|---|
| Feast materialization holds long Postgres transactions | Run against a read replica or during off-peak; index `event_timestamp` on all source tables |
| pgvector ANN performance drops without ivfflat index | `CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` after ~10K rows |
| MLflow artifact upload silently fails without S3 endpoint URL | Always set `MLFLOW_S3_ENDPOINT_URL` for Hetzner Object Storage |
| BentoML autoreloading breaks with mlflow runners in dev | Use `bentoml serve --production` for local testing |
| Feast + SQLAlchemy connection pool leak on long-running services | Set `pool_pre_ping=true`, `pool_recycle=1800` on the Feast Postgres engine |
| Model version drift between MLflow and BentoML image | Pin version at build time (`models:/donor_upgrade/42`, not `.../Production`) once promoted |
| Sacred canary check inside every container adds ~50 ms startup | Acceptable — startup happens rarely; runtime cost is zero |

---

## 11. Alignment With BGOP Doctrine

| Doctrine Reference | How This Architecture Honors It |
|---|---|
| `broyhillgop-doctrine` | Canary + authorization + audit-first patterns baked in at every layer |
| `database-canary-check` | Startup canary + hourly Prefect canary + pre/post migration verification |
| `canonical-donor-join-keys` | Every feature view enforces `cluster_id`; secondary keys documented |
| `donor-centric-architecture` | Donor as primary entity; 2550-dim embedding first-class in Feast; two-tower model natively deployable |
| `donor-grading-system` | Triple grade + intensity_score + level_preference are canonical Feast features |
| `hetzner-server-safety` | All writes go through `bgop_mlops` role with restricted grants; read-only role for offline retrieval |
| `authorization-protocol` | Exact-phrase gate on stage transitions in MLflow + schema changes |
| `candidate-silo-protections` | JWT-based silo enforcement at every BentoML endpoint |
| `agent-security-super-skill` | BentoML services never accept model paths from client input; models pinned at build time |
| `ncrdc-database-protections` | New schemas isolated; role separation prevents cross-schema writes |

---

## 12. Glossary — BGOP-Specific Terms

Definitions of the doctrine, infrastructure, and data-model terms used throughout this document. Every entry cross-references the doctrine skill(s) or wiki page(s) that own the term.

### Infrastructure & Data Model

**Truth source** — The single authoritative store for a piece of data; every other system defers to it. For BGOP this is the Hetzner PostgreSQL 16 instance at `37.27.169.232:5432`. Also called "system of record." See `broyhillgop-data-analyst`, `hetzner-server-safety`.

**Hetzner** — The cloud provider hosting BGOP's truth-source database and application servers. `hetzner-db-01` runs Postgres 16; `hetzner-app-01` runs the candidate portal; `hetzner-ml-01` (new in this architecture) will run MLflow, Feast registry, and Redis. See `hetzner-server-safety`.

**Sacred canary** — An immutable reference row used to detect data corruption. In BGOP: `cluster_id = 372171` must always resolve to exactly 147 transactions totaling $332,631.30, tied to `ed@broyhill.net`. Every migration, ingestion, and (in this architecture) BentoML service startup verifies the canary before proceeding. See `database-canary-check`.

**Sacred canary check** — The pre-flight and post-flight verification that the sacred canary is intact. Runs before AND after any DDL/DML operation on the truth source. See `database-canary-check`.

**BGOP** / **BroyhillGOP** — The full political data and campaign-technology platform. Roughly 80 ecosystems (E00-E76) covering donor intelligence, messaging, event fundraising, candidate portals, and compliance. See `broyhillgop-architecture`.

**NCRDC** — North Carolina Republican Data Cooperative. The institutional client and licensee model that sits above individual candidates; BGOP is its sole authorized data steward. See `sole-steward-ncrdc`, `ncrdc-institutional-client-model`.

**Ecosystem** (E00, E01, E11-E25, E60, E63, E64, E68, etc.) — A numbered functional module in the BGOP platform. Each ecosystem is a self-contained slice with its own schema, agents, and deliverables. Referenced in this doc: **E01** (donor intelligence), **E11-E25** (donor-intelligence moat / bespoke), **E60** (campaign profit engine / LP decision engine), **E63** (news-driven heat tensor), **E64** (conversion surface), **E68** (campaign wizard), **E36** (unified messaging). See `broyhillgop-architecture`.

### Donor Identity & Keys

**cluster_id** — The **primary canonical donor join key.** A `bigint` that resolves to one unique donor identity after BGOP's identity-resolution pipeline (PREP → MATCH → cluster assignment) has run. This is the key every feature view in this architecture joins on. See `canonical-donor-join-keys`, `donor-identity-ingestion`.

**rnc_regid** — The Republican National Committee's voter registration ID. Secondary canonical key for donors who match to the RNC voter file. Used alongside `cluster_id`, never as a replacement. See `canonical-donor-join-keys`.

**Donor spine** — The canonical, deduplicated master list of donor identities keyed by `cluster_id`. The "spine" that every other donor-related table joins against. See `donor-identity-ingestion`.

**Gold spine** — A promoted, human-verified subset of the donor spine treated as ground truth. Segregated from lanes still under identity resolution. See `donor-identity-ingestion`, `broyhillgop-db-session-discipline`.

**PREP** — The pre-match preparation stage of donor ingestion: normalization, address enrichment, employer normalization, before any identity matching. See `donor-identity-ingestion`.

### Donor Intelligence & Scoring

**Donor-intelligence moat** — BGOP's proprietary bespoke donor scoring layer (ecosystems E11-E25). The thing that must NOT be commoditized or replaced with vendor SaaS. This architecture serves this moat, doesn't replace it. See `frankenstein-best-architecture`, `donor-centric-architecture`.

**Triple Grading System** — BGOP's donor grade schema: percentile rank at State level + District level + County level, combined into a `composite_grade`. Ladder is 13 lettered tiers A++ down to D- plus U (unrated). See `donor-grading-system`.

**intensity_score** — 1-10 scalar measuring how strongly a donor engages, independent of capacity. Feature in the Feast `donor_grades` view. See `donor-grading-system`.

**level_preference** — A donor's breadth preference: F (Federal), S (State), L (Local). See `donor-grading-system`.

**Cat 13** — The 13-component donor grading framework. See `donor-grading-system`.

**Donor signature** — The full 10-year × 2,550+ variable representation of one donor. In this architecture, materialized as the pgvector `donor_embedding` feature view. See `donor-centric-architecture`, `donor-profile-enrichment`.

**Two-tower recommender** — The recommendation architecture where a donor tower and a candidate tower produce embeddings that combine via dot product. Donor-intrinsic Receptivity × per-candidate match × candidate capacity. See `donor-centric-architecture`.

**Donor tower / candidate tower** — The two halves of the two-tower model. Donor tower embeds donors; candidate tower embeds candidates. Match score = donor_embedding · candidate_embedding. See `donor-centric-architecture`.

**LP decision engine** — The Linear Programming / Mixed-Integer Programming optimizer that decides which donor × candidate × channel × time combinations to act on, subject to constraints (channel capacity, fatigue caps, TCPA, opt-out, FEC limits, budgets, candidate-time inventory). E60. See `lp-decision-engine`.

**Heat tensor** — The multi-dimensional score tensor (issue × faction × industry × geography) that news events perturb in real time. Re-ranks donor universes for each candidate. E63. See `news-driven-heat-quantification`, `heat-tensor-scoring`.

**Volume knob** — One of 11 community-controlled dials that adjust how strongly a signal (news salience, faction temperature, opponent event, etc.) drives donor scoring. See `news-driven-heat-quantification`.

**Contactability tier** — 4-tier grading of how reachable a donor is via consented channels. Referenced as the `donor_contactability` Feast view. See `contactability-tiering`.

**Faction** — One of 25 donor-side segments used for messaging and clustering. Referenced as the `donor_faction` Feast view. See `donor-faction-assignment`.

**Ask amount elasticity** — The calibration of a prospect's ask amount from lifetime value, capacity tier, and recency. See `ask-amount-elasticity`.

**Race-relational scoring** — The rule "grade the matchup, not the donor." Scoring is a function of the donor's fingerprint × the office class of the race, not the donor alone. See `race-relational-scoring`.

**Office class** — One of 10 taxonomic classes (federal-only, party-committee, statewide-executive, NCGA, judicial, DA-sheriff, local, single-office-specialist, cross-class-strategic). See `race-relational-scoring`.

### Governance & Safety

**Doctrine** — The set of standing rules that govern how BGOP is operated. Encoded as skills. Every deliverable, migration, and deploy is expected to reference doctrine. See `broyhillgop-doctrine`.

**Sacred rules** — The non-negotiable rules within doctrine. Breaking one is treated as a doctrine break requiring lessons-learned. See `broyhillgop-doctrine`.

**Doctrine break** — An incident where doctrine was violated. Documented in lessons-learned mirrors (e.g., May 2 / May 6 / May 8, 2026). See `broyhillgop-doctrine`.

**I AUTHORIZE THIS ACTION** — The exact-phrase authorization gate required before any destructive or irreversible action (production DDL, force-push, firewall change, model promotion to Production, etc.). Soft acknowledgments ("yes", "go", "ok") do NOT count. See `authorization-protocol`.

**Two-phase authorization** — Any mutation on the truth source requires (1) a planned dry-run with CLAIM/PROOF and (2) execution only after the exact-phrase gate. See `broyhillgop-db-session-discipline`, `authorization-protocol`.

**CLAIM / PROOF / VERIFIED** — The three-stage evidence pattern for database work: CLAIM (what will happen), PROOF (the SQL/output that demonstrates it), VERIFIED (post-execution confirmation). See `broyhillgop-db-session-discipline`.

**Candidate silo** — The row-level and application-level isolation guaranteeing no candidate can see another candidate's data. Enforced in this architecture via JWT-based middleware in BentoML services. See `candidate-silo-protections`.

**Silo isolation** / **silo scope** — The scope tag on a feature or table indicating whether it is candidate-scoped (per-candidate rows) or cross-candidate (donor-intrinsic). See `candidate-silo-protections`, `auth-rbac`.

**Five-role hierarchy** — The BGOP RBAC roles: `super_admin`, `ncrdc_admin`, `candidate_admin`, `staff`, `volunteer`. Referenced by the BentoML silo enforcement middleware. See `auth-rbac`.

**Audit trail** — The E10 audit-log discipline: every write to the truth source and every production inference call must land in an audit table with actor, action, timestamp, and payload. In this architecture: `ml_audit.prediction_log` for inference. See `auth-rbac`, `broyhillgop-architecture`.

### Delivery & Operations

**Multi-agent workflow** — BGOP's development model where Cursor, Claude, Codex, and Devin coordinate as concurrent agents against the same repo and truth source. See `ai-agent-super-skill`, `cursor-database-lead`.

**Handoff** — The one-page state summary produced at session end so the next session (or the next agent) does not lose context. See `ai-session-handoff`.

**Nexus** — The BGOP agent startup, relay, and coordination repository. "Nexus wake" starts a session; "Nexus sleep" ends one. See `nexus-startup`.

**Brain** — The user's durable knowledge wiki (memory/knowledge/) plus the runtime brain-trigger dispatcher that routes events to actions. See `brain-worker-architecture`, `brain-trigger-dispatcher`.

**Brain worker** — The asynchronous event-processing layer that consumes inbound events, routes them to universes, fires triggers, and guarantees durability via write-first-to-database. See `brain-worker-architecture`.

**Brain trigger** — A row in `brain.triggers` that maps an incoming event pattern to an action under Brain governance. See `brain-trigger-dispatcher`.

---

## 13. Primary Sources

- [Feast PostgreSQL online store](https://docs.feast.dev/reference/online-stores/postgres) — including pgvector support
- [Feast Postgres offline store](https://docs.feast.dev/reference/offline-stores/postgres)
- [MLflow tracking server production deployment](https://mlflow.org/docs/latest/tracking/server.html)
- [MLflow Model Registry](https://mlflow.org/docs/latest/model-registry.html)
- [BentoML documentation](https://docs.bentoml.com/)
- [BentoML + MLflow integration guide](https://docs.bentoml.com/en/latest/integrations/mlflow.html)
- [pgvector — vector similarity for Postgres](https://github.com/pgvector/pgvector)
- [Hetzner Object Storage S3-compatible API](https://docs.hetzner.com/storage/object-storage/overview)
