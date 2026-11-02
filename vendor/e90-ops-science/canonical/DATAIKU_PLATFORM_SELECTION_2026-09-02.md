# E90 Platform Selection

**Decision:** Dataiku DSS plus Gurobi  
**Status:** Design selection, not procurement, installation, deployment, or production authorization  
**Ecosystem:** E90 Operations MGT  
**Sole purpose:** **OPTIMIZE EFFICIENCIES**

## Selected architecture

### Dataiku DSS is the governed analytical workbench used by E90

Dataiku is selected for:

- PostgreSQL-connected datasets and in-database SQL recipes;
- Python recipes for custom efficiency and optimization logic;
- visual Flow lineage across E001-E105 station inputs and outputs;
- scenarios for scheduled and event-driven analysis;
- metrics, checks, and Data Quality rules;
- model evaluation and drift monitoring;
- governed collaboration among data, ML, and operations users;
- pluggable code environments for external solvers.

The controlling Wizard-first doctrine identifies **E60 as Campaign Profit/Dataiku**. E90 therefore uses Dataiku through the E60-owned or later ratified shared Dataiku service boundary; it does not claim exclusive ownership of Dataiku or supersede E60 ([Wizard-first identity freeze](https://github.com/broyhill/BroyhillGOP/blob/main/docs/canonical/ECO_IDENTITY_FREEZE_WIZARD_FIRST_2026-08-11.md)).

Dataiku Python recipes can read and write datasets across storage backends and use either Pandas or streaming patterns ([Dataiku Python recipes](https://doc.dataiku.com/dss/latest/code_recipes/python.html)). SQL recipes can execute fully in the database when inputs and outputs share a connection, avoiding unnecessary data movement ([Dataiku SQL recipes](https://doc.dataiku.com/dss/latest/code_recipes/sql.html)). Dataiku scenarios automate Flow builds and model training ([Dataiku scenarios](https://doc.dataiku.com/dss/latest/scenarios/index.html)), and its metrics, checks, and Data Quality rules provide the control points E90 needs for efficiency monitoring ([Dataiku metrics and checks](https://doc.dataiku.com/dss/latest/metrics-check-data-quality/index.html)).

### Gurobi is the authoritative optimizer

Gurobi is selected as the primary mathematical solver for:

- linear programming;
- mixed-integer programming;
- line balancing;
- resource allocation;
- capacity planning;
- improvement-portfolio selection;
- robust and stochastic formulations;
- infeasibility diagnosis;
- sensitivity and bound reporting.

Gurobi exposes APIs to formulate a model, invoke the solver, and inspect the resulting solution ([Gurobi Optimizer reference](https://docs.gurobi.com/projects/optimizer/en/current/index.html)).

### Specialized and fallback solvers

- **OR-Tools CP-SAT:** Scheduling, assignment, routing, and logical constraint problems.
- **HiGHS:** Open-source LP/MIP fallback and portability.
- **Exact dynamic programming:** Small bounded canaries and unit tests.

Fallback results must never be mislabeled. A heuristic result is `HEURISTIC_NOT_OPTIMAL`, while an exact or solver-certified result may be `OPTIMAL_PROVEN`.

## Why the generic AI-operations tools were not selected

ChatGPT, Microsoft Copilot, Notion AI, ClickUp, Ramp, Zapier, Make, n8n, and Marblism address drafting, office productivity, project tracking, application automation, finance operations, or delegated back-office tasks. They may support humans or connect systems, but they do not provide the governed mathematical-optimization, constraint, sensitivity, and proof layer E90 requires.

No general AI assistant is the E90 solver. An AI may explain a result, propose a model, or help investigate a bottleneck, but only a versioned mathematical model and solver receipt count as optimization evidence.

## Enterprise alternatives considered

| Platform | Strength | E90 fit judgment |
|---|---|---|
| **Amazon SageMaker AI** | Scaled model training, deployment, governance, pipelines, and monitoring ([AWS SageMaker MLOps](https://aws.amazon.com/sagemaker/ai/mlops/)) | Strong if NC FIRST standardizes on AWS; otherwise introduces a cloud control plane around a Hetzner/PostgreSQL-centered platform |
| **Databricks** | Lakehouse-scale data engineering, Spark, MLflow, and MLOps workflows ([Databricks MLOps workflows](https://docs.databricks.com/aws/en/machine-learning/mlops/mlops-workflow)) | Strong for lakehouse-scale distributed data; heavier than needed for the first E90 station and may duplicate the PostgreSQL-centered evidence plane |
| **DataRobot** | AutoML deployment, model monitoring, governance, and challenger models ([DataRobot MLOps](https://docs.datarobot.com/en/docs/mlops/index.html)) | Strong predictive-model platform; less natural as the cross-ecosystem SQL, queue, process, and OR/MS workbench |
| **OpenText AI Operations Management** | IT observability, incident prevention, topology correlation, and remediation ([OpenText AI Operations Management](https://www.opentext.com/products/ai-operations-management)) | Solves IT operations and infrastructure incidents, not NC FIRST business-process and campaign-resource optimization |
| **Dataiku DSS** | Mixed SQL/Python workflows, Flow lineage, scenarios, checks, quality, model evaluation, and custom environments | Best fit for E90's governed analysis around the existing PostgreSQL architecture |

## Important limitation

Dataiku's packaged Optimization Tool is a knapsack optimizer, not a complete enterprise OR/MS engine ([Dataiku Optimization Tool](https://doc.dataiku.com/dss/latest/agents/tools/optimization.html)). Therefore:

> **E90 uses the governed Dataiku surface without superseding E60. Gurobi performs authoritative optimization.**

This separation prevents a convenient visual tool from being mistaken for the mathematical decision engine.

## Non-deployment boundary

This decision does not authorize:

- purchasing or licensing Dataiku or Gurobi;
- installing packages on Hetzner;
- creating PostgreSQL schemas;
- connecting Dataiku to production;
- running optimization against live donor or candidate data;
- implementing an E90 recommendation;
- changing any other ecosystem.
