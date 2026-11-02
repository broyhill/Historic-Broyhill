# E90 Operations MGT Source Package

**Status:** Design and test package only. Not deployed. No production database changes authorized.  
**Purpose:** **OPTIMIZE EFFICIENCIES.**

## Industry-best stack

E90 uses a best-of-breed stack rather than treating a general AI assistant as an Operations Research engine:

1. **Dataiku DSS:** Governed Flow, datasets, SQL and Python recipes, scenarios, metrics, checks, model evaluation, drift monitoring, and operational visibility.
2. **Gurobi:** Authoritative LP/MIP solver for allocation, line balancing, capacity, portfolio selection, and sensitivity analysis.
3. **OR-Tools CP-SAT:** Specialized scheduling, assignment, routing, and discrete constraint problems.
4. **HiGHS:** Open-source LP/MIP fallback and portability layer.
5. **PostgreSQL:** Durable station registry, work-in-process state, queue observations, constraints, optimization receipts, and outcome lineage.

Dataiku supports Python recipes that read and write datasets, including streaming and chunked patterns for large data ([Dataiku Python recipes](https://doc.dataiku.com/dss/latest/code_recipes/python.html)). It supports SQL recipes with in-database execution when inputs and output share a connection ([Dataiku SQL recipes](https://doc.dataiku.com/dss/latest/code_recipes/sql.html)). Scenarios automate builds and model training ([Dataiku scenarios](https://doc.dataiku.com/dss/latest/scenarios/index.html)), while metrics, checks, and Data Quality rules can govern Flow items ([Dataiku metrics and checks](https://doc.dataiku.com/dss/latest/metrics-check-data-quality/index.html)).

Dataiku's packaged Optimization Tool is limited to knapsack-style optimization, so it is insufficient as the complete E90 solver ([Dataiku Optimization Tool](https://doc.dataiku.com/dss/latest/agents/tools/optimization.html)). Dataiku permits custom Python environments and packages, making it the orchestration and governance layer around Gurobi, OR-Tools, and HiGHS rather than the mathematical engine itself ([Dataiku code environments](https://doc.dataiku.com/dss/latest/code-envs/index.html)). Gurobi provides APIs for formulating, solving, and inspecting mathematical optimization models ([Gurobi Optimizer documentation](https://docs.gurobi.com/projects/optimizer/en/current/index.html)).

The main-branch Wizard-first doctrine assigns Campaign Profit/Dataiku to E60. E90 consumes that governed service surface and does not replace E60.

## Package contents

```text
taxonomy/e90_efficiency_taxonomy_v0.1.json
taxonomy/e90_operations_method_registry_v0.1.json
taxonomy/e90_metric_taxonomy_v0.1.json
sql/001_e90_operations_mgt_schema_DRYRUN.sql
sql/010_e90_efficiency_views_DRYRUN.sql
sql/020_e90_safe_metric_views_DRYRUN.sql
sql/030_e90_e20_e68_handoff_DRYRUN.sql
python/e90_efficiency_engine.py
python/e90_method_router.py
python/e90_sql_guard.py
python/e90_wizard_handoff.py
python/dataiku_e90_recipe.py
python/dataiku_e90_text_to_sql_guard_recipe.py
contracts/E90_E20_E68_INTEGRATION_CONTRACT_2026-09-03.md
contracts/e90_efficiency_recommendation_v0.1.schema.json
tests/test_e90_efficiency_engine.py
tests/test_e90_method_router.py
tests/test_e90_sql_guard.py
tests/test_e90_wizard_handoff.py
```

## Dataiku Flow

```text
PostgreSQL station observations
  -> SQL recipe: current station metrics
  -> Data Quality checks
  -> Python recipe: bottleneck detection
  -> Python recipe: Gurobi improvement portfolio
  -> E90 recommendation dataset
  -> human review
  -> separate governed implementation process

Model Evaluation Store
  -> prediction and data drift metrics
  -> E90 station observations
  -> retraining or hold recommendation
```

Dataiku may schedule, compute, check, and publish recommendations. It must not convert an E90 recommendation into a production change.

## Cognitive method-selection layer

E84 stores and retrieves the approved Operations Management knowledge. A bounded RAG or agent layer may identify candidate methods and draft a typed formulation. The deterministic E90 method router then selects an approved algorithm family from the machine-readable registry.

The LLM never performs the authoritative calculation and never converts prose directly into a production command. A validated solver or statistical procedure performs the computation, and the result remains a recommendation.

For Text-to-SQL, E90 indexes metadata, approved view definitions, metric definitions, units, and policy versions rather than operational rows. Generated SQL must pass the AST-based guard, reference only fully qualified allowlisted analytical views, contain exactly one read-only query, and run under a database-enforced read-only role with row and time limits.

## Algorithm policy

| Problem | Primary algorithm | Alternate | Proof requirement |
|---|---|---|---|
| Improvement portfolio | Gurobi binary MIP | HiGHS MIP | Optimality gap, selected set, constraints |
| Line balancing | Gurobi MIP | HiGHS MIP | Station assignment and capacity receipt |
| Scheduling | OR-Tools CP-SAT | Gurobi MIP | Feasible schedule and conflict proof |
| Assignment | Gurobi or Hungarian | OR-Tools | Assignment cost and unmatched work |
| Routing and constrained flow | Min-cost flow | Gurobi network model | Flow conservation and capacity proof |
| Queue capacity | Queueing model plus simulation | Discrete-event simulation | Assumptions, utilization, wait distribution |
| Bottleneck detection | Theory of Constraints score | Change-point analysis | Ranked constraint evidence |
| Quality drift | SPC, EWMA, CUSUM | Dataiku drift metrics | Baseline, threshold, warning or hold |
| Robust planning | Scenario MIP | Robust optimization | Scenario distribution and downside bound |
| Small bounded test | Exact dynamic programming | Enumeration | Exact objective value |

Any fallback that cannot prove optimality must label its output `HEURISTIC_NOT_OPTIMAL`.

## Safety boundary

- This package never connects to Hetzner.
- SQL files are inert DDL design artifacts and are not executed.
- Python code has no network, messaging, deployment, or database-write capability.
- The Dataiku wrapper writes only configured Dataiku output datasets.
- Recommendations require separate review and authorization before any implementation.
- E90 never bypasses E72, E68, E20, or the Action Execution Socket.

## Local validation

```bash
python -m unittest discover -s tests -p 'test_*.py'
```
