# BANT — Behavioral Adaptive Nurture Targeting (v0.1.0)

Experimental **prospect scoring organ** under **E01**. Adapts classic BANT
(Budget / Authority / Need / Timing) to BroyhillGOP’s omnichannel fabric.

## Hard rules

| May | Must not |
|-----|----------|
| Score prospects into schema `bant` | Fire guns / call ActionSocket FIRE |
| Feed E59 / E20 / E68 / E60 | Write sacred tables |
| Run OBSERVE / in-memory | Process donations / hold PCI |
| Extend `ifttt.rules` / `brain.triggers` | Create parallel trigger catalogs |

## Layout

```
ECO_CANONICAL/E01/code/bant/
  __init__.py
  config.py
  features.py
  scorer.py
  db.py
  service.py              # FastAPI :8491
  feature_dictionary.json
  contracts/*.schema.json
  README.md

ECO_CANONICAL/E01/sql/
  DRYRUN_BANT_PROSPECT_SCORE_2026-08-02.sql

database/migrations/dryrun/
  DRYRUN_BANT_PROSPECT_SCORE_2026-08-02.sql   # canonical dry-run path
  DRYRUN_BANT_TRIGGER_HOOK_2026-08-02.sql     # ifttt.rules extend (inactive)

ECO_CANONICAL/E01/tests/
  test_bant_scorer.py
```

## Run scorer (in-memory)

```bash
cd /path/to/BroyhillGOP
PYTHONPATH=ECO_CANONICAL/E01/code python3 -c "
from bant import BantScorer
s = BantScorer()
print(s.score_one('demo_silo', 1001, {
  'F_DON_TOTAL_10Y': 0.9,
  'F_HEAT_ISSUE': 0.8,
  'F_DON_RECENCY_DAYS': 0.7,
  'F_FATIGUE_HEADROOM': 0.6,
}).to_dict())
"
```

## Run API

```bash
pip install fastapi uvicorn pydantic
cd ECO_CANONICAL/E01/code
BANT_OBSERVE_ONLY=true uvicorn bant.service:app --host 127.0.0.1 --port 8491
# GET  /health
# GET  /v1/feature-dictionary
# POST /v1/score
# POST /v1/score/batch
# GET  /v1/integration
```

## SQL apply (gated)

1. Two-agent review of `DRYRUN_BANT_PROSPECT_SCORE_2026-08-02.sql`
2. Canary 147 / $332,631.30
3. Ed: `I AUTHORIZE THIS ACTION`
4. Apply + canary + `ops.deploy_log`

Model row seeds with `is_active = FALSE` until Ed activates.

## Integration map

```
features (spines) → BANT score → bant.prospect_score
                                      ├→ E59 microsegment compiler
                                      ├→ E20 GO / suppress features
                                      ├→ E60 LP allocation input
                                      └→ E68 Wizard audience display
ActionSocket / 16 guns remain the ONLY send path.
```
