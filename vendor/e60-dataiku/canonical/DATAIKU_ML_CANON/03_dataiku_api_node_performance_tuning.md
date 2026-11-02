# Dataiku API Node — Performance Tuning Checklist

**Purpose:** Operational runbook for tuning Dataiku API nodes for real-time donor-upgrade scoring
**Audience:** BroyhillGOP platform + DevOps engineers
**Latency target reference:** p95 < 100 ms for single-record scoring, p95 < 500 ms for batch of 100

---

## 1. Java-Optimized Scoring

Java scoring uses a compiled JVM scorer instead of the Python runtime, yielding **10-100× throughput improvement** on tabular models ([Scoring engines](https://doc.dataiku.com/dss/latest/machine-learning/scoring-engines.html), [Exposing a Visual Model](https://doc.dataiku.com/dss/latest/apinode/endpoint-std.html)).

### 1.1 Prerequisites Checklist

- [ ] Model is a **visual ML** model (custom Python models cannot use Java scoring)
- [ ] Model backend is **In-memory Python** (scikit-learn / XGBoost); **not MLLib**
- [ ] Algorithm supports Java export — confirm on the Saved Model's version detail page: "Local (Optimized)" must appear in the "Scoring modes" list
- [ ] All preprocessing steps are within the Java-scoring supported subset:
  - **Numerical:** No rescaling, Rescaling, Binning, Derivative features, Flag presence, Imputation, Drop row, Datetime cyclical encoding
  - **Categorical:** Dummification, Target encoding (impact and GLMM), Flag presence
  - **Text:** Basic vectorization (tf-idf); heavy NLP not supported
- [ ] Row-level explanations are **not required** on this endpoint (Java scoring disables per-request explanations — see §5)

### 1.2 Enable Java Scoring (Design Node)

1. Open the API service in **API Designer**
2. Select the prediction endpoint
3. Under **Endpoint settings** → tick **"Use Java"**
4. Save the endpoint
5. Regenerate the API package: **Actions → Create version**
6. In API Deployer, deploy the new package to your infrastructure

### 1.3 Verify Java Scoring Is Actually Active

After deployment, inspect an endpoint response's `serverTiming` field or query logs. In query logs on the API node:

```json
{
  "clientEvent": {
    "timing": {
      "predictMs": 3,           // Java: single-digit ms
      "preprocessMs": 1,
      "postprocessMs": 0
    }
  }
}
```

If `predictMs` > 30 for a small tabular model, Java scoring is likely NOT active. Check the endpoint config JSON and API package build log.

### 1.4 XGBoost Version Gotcha

DSS 13 upgraded default XGBoost to 1.5. Models trained before must either be retrained OR passed through the migration tool. Otherwise, Java scoring will silently fall back to Python ([DSS 13 Release notes](https://doc.dataiku.com/dss/latest/release_notes/13.html)).

---

## 2. Concurrent Request Pool Sizing

The API node runs each endpoint with a dedicated **pipeline pool** ([Exposing a Visual Model](https://doc.dataiku.com/dss/latest/apinode/endpoint-std.html)). Configuration file:

```
$APINODE_DATA_DIR/config/services/{SERVICE_ID}/{ENDPOINT_ID}.json
```

```json
{
  "pool": {
    "floor":   2,
    "cruise":  4,
    "ceil":   12,
    "queue":  32,
    "timeout": 5000
  }
}
```

| Parameter | Default | Meaning |
|---|---|---|
| `floor` | 1 | Minimum pipelines (pre-allocated at load) |
| `cruise` | 2 | Nominal steady-state pipeline count |
| `ceil` | 8 | Hard cap on concurrent pipelines |
| `queue` | 16 | Requests queued when all pipelines busy (fair FIFO) |
| `timeout` | 10000 | Milliseconds a request waits in queue before 503 |

### 2.1 Sizing Formula

Each pipeline holds one loaded model instance in memory plus per-request working memory.

**Step 1 — Measure model footprint:**

Deploy the endpoint with `floor=1, cruise=1, ceil=1`. On the API node:

```bash
# Baseline before endpoint load
free -m > /tmp/before.txt

# Hit the endpoint once to warm the pipeline
curl -X POST http://localhost:12000/public/api/v1/{svc}/{ep}/predict \
  -H "Content-Type: application/json" \
  -d '{"features": {...}}'

# Steady-state
free -m > /tmp/after.txt
```

`MEM_PER_PIPELINE_MB = (used_after − used_before)` — for a typical XGBoost donor-upgrade model, expect **150-400 MB per pipeline** with Java scoring, **400-900 MB** with Python scoring.

**Step 2 — Compute pool ceiling per node:**

```
USABLE_RAM_MB = TOTAL_RAM_MB - OS_RESERVE_MB - JVM_OVERHEAD_MB
             = TOTAL_RAM_MB - 2048 - 4096   (typical)

CEIL_PER_ENDPOINT = floor(USABLE_RAM_MB * ENDPOINT_RAM_SHARE / MEM_PER_PIPELINE_MB)
```

Where `ENDPOINT_RAM_SHARE` is the fraction of usable RAM you allocate to this endpoint (`0.5` if the node hosts one hot endpoint plus lookups, `0.3` if multiple hot models).

**Step 3 — CPU cross-check:**

```
CPU_CEIL = min(CEIL_PER_ENDPOINT, vCPUs * 2)
```

`× 2` because a scoring pipeline spends part of its cycle in I/O (deserialize, response encode). Above 2× vCPU count, you get context-switch overhead without throughput gains.

**Step 4 — Set cruise:**

```
cruise = ceil(P95_CONCURRENT_REQUESTS * AVG_LATENCY_MS / 1000)
```

Where `P95_CONCURRENT_REQUESTS` is your observed 95th-percentile concurrent request count during peak. Round up.

**Step 5 — Set queue and timeout:**

```
queue   = 2 × ceil                             # absorb short spikes
timeout = 2 × P99_LATENCY_MS                   # never below 2000 ms
```

### 2.2 Worked Example — BGOP Donor Upgrade Endpoint

**Assumption:** Hetzner CX41 API node: 4 vCPU, 16 GB RAM. Model = XGBoost with Java scoring, 220 MB per pipeline. One hot endpoint plus dataset-lookup endpoints sharing the node.

```
USABLE_RAM_MB      = 16384 - 2048 - 4096 = 10240 MB
ENDPOINT_RAM_SHARE = 0.6
CEIL_PER_ENDPOINT  = floor(10240 * 0.6 / 220)   = 27
CPU_CEIL           = min(27, 4 * 2)              = 8

Observed:  P95 concurrent = 12, avg latency = 15 ms, P99 latency = 45 ms

cruise  = ceil(12 * 15 / 1000)  = 1   → bump floor to 4 for load-time safety
ceil    = 8
queue   = 16
timeout = max(2000, 2 * 45)     = 2000
```

**Final config:**

```json
{
  "pool": {
    "floor": 4,
    "cruise": 4,
    "ceil": 8,
    "queue": 16,
    "timeout": 2000
  }
}
```

### 2.3 JVM Heap Setting (Critical)

Configured in `$DSS_HOME/install.ini` via `xmx`. **Do not set between 32 GB and 48 GB** — DSS disables compressed references above 32 GB, and the transition zone loses more heap than it gains ([WARN_JVM_CONFIG_XMX_IN_RED_ZONE](https://doc.dataiku.com/dss/latest/troubleshooting/errors/WARN_JVM_CONFIG_XMX_IN_RED_ZONE.html)).

Safe values: `≤ 30g` or `≥ 48g`. For most BGOP-scale API nodes: **`xmx=8g` to `xmx=24g`**.

---

## 3. Horizontal Scaling — Multiple API Instances

### 3.1 Static Infrastructure (Load-Balanced Cluster)

Pattern: 3+ API nodes behind a Layer-7 load balancer with session-less round-robin (endpoints are stateless).

**Step-by-step ([HA docs](https://doc.dataiku.com/dss/latest/apinode/operations/ha-deployment.html)):**

1. **Provision N API nodes** (identical hardware, identical DSS version)
2. **On each node:** run installer with `--type api`; generate admin key:
   ```bash
   cd $APINODE_DATA_DIR
   ./bin/apinode-admin admin-key-create
   ```
3. **On the Design/Deployer node:** API Deployer → Infrastructures → **New Infrastructure** → type = `Static`
4. Add each API node: base URL + admin API key
5. Grant deploy permissions to the appropriate DSS user group
6. Deploy the same API package to all nodes — API Deployer distributes the bundle
7. **In front:** put an HAProxy / Nginx / cloud LB with health check on `GET /public/api/health/liveness` and `/health/readiness`

**HAProxy example:**

```
frontend api_scoring
  bind *:443 ssl crt /etc/haproxy/certs/bgop.pem
  default_backend api_nodes

backend api_nodes
  balance roundrobin
  option httpchk GET /public/api/health/readiness
  http-check expect status 200
  timeout server 5s
  server api1 10.0.1.10:12000 check inter 5s
  server api2 10.0.1.11:12000 check inter 5s
  server api3 10.0.1.12:12000 check inter 5s
```

### 3.2 Kubernetes Deployment

**Prerequisites:**
- K8s cluster (EKS/GKE/AKS or on-prem) with LoadBalancer or Ingress support
- Container registry accessible from the cluster
- Base image built:
  ```bash
  ./bin/dssadmin build-base-image --type apideployer --tag dku-apideployer:14.0.0
  ```

**Step-by-step ([Deploying on Kubernetes](https://doc.dataiku.com/dss/latest/apinode/kubernetes/index.html)):**

1. **Configure kubectl** on the API Deployer host; verify: `kubectl get nodes`
2. **API Deployer → Infrastructures → New Infrastructure → type = Kubernetes cluster**
3. Fill in: cluster name, namespace, container registry URL, base image tag
4. **Deploy the API service** — DSS builds a per-service image and pushes to registry
5. **Configure scaling** in Deployment Settings → Sizing and Scaling:
   - `initialReplicas` — pods at deploy time
   - `hpaMinPods` / `hpaMaxPods` — HPA bounds
   - CPU/memory requests + limits per pod
6. **Expose via Service or Ingress** — see the [service expositions guide](https://doc.dataiku.com/dss/latest/apinode/kubernetes/expositions.html)

**HPA on custom metric (query latency) — recommended for BGOP:**

Follow the [self-healing tutorial](https://knowledge.dataiku.com/latest/admin-operating/instance-monitoring/tutorial-monitor-api-services.html):

```python
# Scenario Python step — run every 5 minutes
import dataiku
client = dataiku.api_client()
deployer = client.get_apideployer()
deployment = deployer.get_deployment("donor_upgrade_prod")
settings = deployment.get_settings()

# Read latency from query logs dataset
latency_p75_ms = read_latency_metric()  # your metric read

if latency_p75_ms > 200:
    settings.settings["deploymentScaling"]["hpaMaxPods"] += 2
    settings.settings["deploymentScaling"]["initialReplicas"] = \
        settings.settings["deploymentScaling"]["hpaMaxPods"]
    settings.save()
    deployment.start_update()
```

**Note:** DSS docs recommend not running the scaling scenario more frequently than every 1-2 minutes.

### 3.3 GPU Nodes (If Adding Neural Ranker)

Only relevant if the two-tower model or a transformer-based donor embedding lives on the API node. Build CUDA base image:

```bash
./bin/dssadmin build-base-image --type apideployer --with-cuda \
  --tag dataiku-apideployer-base-cuda:14.0.0
```

At infrastructure or deployment level, add custom limit `nvidia.com/gpu: 1` ([GKE deployment guide](https://doc.dataiku.com/dss/latest/apinode/kubernetes/gke.html)).

---

## 4. Latency Bottleneck Troubleshooting

### 4.1 Symptom → Cause → Fix Matrix

| Symptom | Likely Cause | Fix |
|---|---|---|
| High p50 latency (>50 ms), consistent | Python scoring, not Java | Enable "Use Java" on endpoint |
| High p99 latency, spiky | Pipeline creation on demand (cruise too low) | Raise `floor` and `cruise` to match steady load |
| 503 timeouts at peak | Queue overflow or timeout too tight | Raise `queue`, `timeout`, or `ceil` |
| Consistent 429s | Rate-limit at API Deployer or LB | Check LB config and API service auth quota |
| Slow first request after deploy | Cold pipeline load | Set `floor ≥ 2`; add warmup step in scenario |
| Latency climbs over hours | Memory leak or GC pressure | Check JVM GC logs; consider heap tuning |
| DB lookup endpoint slow | SQL pool exhausted | Raise `sqlMaxPool` per [SQL pool discussion](https://community.dataiku.com/discussion/15513/api-node-sql-max-pool-parameter-setting) |
| Uneven latency across nodes | LB imbalance or heterogeneous hardware | Check LB algorithm; use `leastconn` if pipeline times vary |
| High preprocessing time | Complex feature engineering in scoring path | Move to Java-supported preprocessors, or precompute upstream |

### 4.2 Diagnostic Queries

Enable **query logs** on the API service (Endpoint settings → Auditing). Query logs land in a JSON stream per node — expose as a dataset and query:

```sql
-- P75 / P95 / P99 latency last hour
SELECT
  endpointId,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY total_ms) AS p50,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY total_ms) AS p75,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms) AS p99,
  COUNT(*) AS n
FROM api_query_logs
WHERE serverTimestamp > NOW() - INTERVAL '1 hour'
GROUP BY endpointId;
```

### 4.3 Memory Consumption Monitoring

**Per-pipeline memory:** Track via a JVM metrics scraper (JMX Exporter → Prometheus → Grafana). Key metrics:

- `jvm_memory_used_bytes{area="heap"}` — should sit at 40-70% of `xmx`
- `jvm_gc_pause_seconds` — sustained > 100 ms indicates heap pressure
- `dku_apinode_pipelines_active{service, endpoint}` — should oscillate around `cruise`
- `dku_apinode_queue_depth{service, endpoint}` — sustained > 0 means undersized `ceil`

**OS-level:** Cron a lightweight sampler:

```bash
# /etc/cron.d/apinode-mem-sample — every minute
* * * * * dataiku ps -o pid,rss,cmd -C java --no-headers \
  >> /var/log/dku/apinode-mem.log
```

**Alert thresholds (BGOP-recommended):**

| Metric | Warn | Page |
|---|---|---|
| Heap used % | > 75% for 10 min | > 90% for 5 min |
| GC pause p95 | > 200 ms | > 1000 ms |
| Queue depth | > 4 for 5 min | > queue×0.75 for 2 min |
| p95 latency | > 2× baseline | > 5× baseline |
| Error rate | > 0.5% | > 2% |

### 4.4 Timeout Configuration Layers

Multiple timeout layers stack — misconfiguration causes false failures. Set them **outer > inner**:

```
Client HTTP timeout          10 s
  └── Load Balancer timeout   8 s
       └── K8s Service        7 s
            └── API Node queue timeout (`timeout` in pool JSON)   5 s
                 └── Per-request execution   (implicit; typically <100 ms)
```

Rule of thumb: **client timeout ≥ 2× LB timeout ≥ 1.5× API node queue timeout**.

For BGOP donor upgrade scoring (real-time, called by candidate portal):

| Layer | Recommended Value |
|---|---|
| Client (JavaScript fetch) | 5000 ms |
| CloudFront / LB | 4000 ms |
| API Node `pool.timeout` | 2000 ms |
| SQL lookup timeout | 1000 ms |

---

## 5. Row-Level Explanations Trade-off

Explanations (SHAP-style contributions per feature) are supported but **disable Java scoring for that request** ([Exposing a Visual Model](https://doc.dataiku.com/dss/latest/apinode/endpoint-std.html)):

```json
{
  "features": {"rnc_regid": "NC-1234567", "..."},
  "explanations": {"enabled": true, "nb_explanations": 5}
}
```

**Recommendation for BGOP:**
- **Approval-queue and campaign-heat pages** — Java scoring, no explanations (fast, thousands of requests)
- **Donor detail page ("why is this donor A+?")** — explanations endpoint, separate deployment with generous timeout (5-10 s), lower `ceil` (2-4)

Split into two API services rather than one, so the fast path is not throttled by the slow path.

---

## 6. Deployment Runbook (Copy-Paste Checklist)

### Pre-deploy
- [ ] Model uses Java-compatible preprocessing only
- [ ] "Use Java" checked in endpoint settings
- [ ] Endpoint pool config JSON matches sizing formula for target hardware
- [ ] JVM `xmx` in `install.ini` is not in the 32-48 GB red zone
- [ ] Query log auditing enabled on the endpoint
- [ ] Health check endpoints (`/health/liveness`, `/health/readiness`) reachable

### Deploy
- [ ] Package created on Design node
- [ ] Package pushed to API Deployer
- [ ] Deployment created against target infrastructure (static cluster or K8s)
- [ ] All API nodes report the new package as Active
- [ ] Load balancer health checks all green

### Post-deploy
- [ ] Warmup: hit endpoint 100× to force pipeline pre-allocation
- [ ] Baseline p50/p95/p99 latency captured
- [ ] Prometheus scraper alerts armed
- [ ] Rollback plan: previous package identified, one-click restore verified

### Weekly review
- [ ] Query log dashboard scanned for drift in latency percentiles
- [ ] Pool utilization checked — adjust `cruise` if steady-state is off by >30%
- [ ] Memory graph checked — heap growth trend, GC pause histogram
- [ ] Error-rate dashboard scanned — group by endpoint, then by client

---

## 7. BGOP-Specific Overlay

If DSS is ever adopted for donor upgrade scoring, enforce these guardrails from `broyhillgop-doctrine` and `hetzner-server-safety`:

1. **Sacred canary check** — Every scenario that regenerates the API package must first run a Python step verifying cluster 372171 = 147 txns / $332,631.30 / ed@broyhill.net in the training data. Fail-close if wrong.
2. **Two-phase authorization** — Model version activation on a production endpoint requires the exact-phrase `I AUTHORIZE THIS ACTION` per `authorization-protocol`.
3. **Candidate silo enforcement** — Add a middleware Python function endpoint that intercepts every prediction request, verifies the caller's `candidate_id` against the JWT, and rejects cross-candidate lookups.
4. **Audit log** — Every prediction call writes to a Postgres audit table with `endpoint_id`, `candidate_id`, `donor_pseudonym_id`, `probas`, `served_from_pipeline_id`, `latency_ms`, `timestamp`.

---

## Primary Sources

- [Exposing a Visual Model — pool config and Java scoring](https://doc.dataiku.com/dss/latest/apinode/endpoint-std.html)
- [Scoring engines — Java optimized scoring supported preprocessing](https://doc.dataiku.com/dss/latest/machine-learning/scoring-engines.html)
- [High availability and scalability](https://doc.dataiku.com/dss/latest/apinode/operations/ha-deployment.html)
- [Deploying on Kubernetes](https://doc.dataiku.com/dss/latest/apinode/kubernetes/index.html)
- [Deployment on GKE with GPU](https://doc.dataiku.com/dss/latest/apinode/kubernetes/gke.html)
- [Self-healing API service deployments on Kubernetes](https://knowledge.dataiku.com/latest/admin-operating/instance-monitoring/tutorial-monitor-api-services.html)
- [JVM Xmx red zone warning](https://doc.dataiku.com/dss/latest/troubleshooting/errors/WARN_JVM_CONFIG_XMX_IN_RED_ZONE.html)
- [DSS 13 Release notes — XGBoost migration](https://doc.dataiku.com/dss/latest/release_notes/13.html)
- [DSS 14 Release notes — XGBoost GPU, TabICL](https://doc.dataiku.com/dss/latest/release_notes/index.html)
- [API Node user API — Python client](https://doc.dataiku.com/dss/latest/apinode/api/user-api.html)
- [API Node SQL Max Pool discussion](https://community.dataiku.com/discussion/15513/api-node-sql-max-pool-parameter-setting)
