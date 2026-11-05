"""
BANT FastAPI service — prospect scoring only.

  uvicorn ECO_CANONICAL.E01.code.bant.service:app --host 127.0.0.1 --port 8491

Or from this directory:
  PYTHONPATH=<repo-root> uvicorn bant.service:app --port 8491

NEVER fires guns. NEVER writes sacred tables. Default observe_only=true.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from .config import BantConfig
from .scorer import BantScorer

config = BantConfig()
scorer = BantScorer(config)

app = FastAPI(
    title="BANT Prospect Scoring",
    version="0.1.0",
    description=(
        "Behavioral Adaptive Nurture Targeting — scores feed E20/E59/E68. "
        "Does not send communications. Does not process donations."
    ),
)


class ScoreRequest(BaseModel):
    silo_id: str = Field(..., min_length=1, description="Candidate/committee silo")
    cluster_id: int = Field(..., description="Donor cluster_id (INTEGER)")
    jurisdiction_key: Optional[str] = None
    features: Optional[Dict[str, Any]] = None
    persist: bool = False

    @field_validator("cluster_id")
    @classmethod
    def cluster_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("cluster_id must be positive INTEGER")
        return v


class BatchItem(BaseModel):
    cluster_id: int
    jurisdiction_key: Optional[str] = None
    features: Optional[Dict[str, Any]] = None


class BatchScoreRequest(BaseModel):
    silo_id: str = Field(..., min_length=1)
    items: List[BatchItem] = Field(..., min_length=1, max_length=5000)
    persist: bool = False


class ScoreResponse(BaseModel):
    silo_id: str
    cluster_id: int
    model_id: str
    budget_score: int
    authority_score: int
    need_score: int
    timing_score: int
    bant_composite: float
    p_act: float
    expected_amount: Optional[float]
    tier: str
    reason_vector: List[Dict[str, Any]]
    microsegment_hints: List[str]
    jurisdiction_key: Optional[str]
    opponent_safe: bool
    observe_only: bool


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "bant",
        "version": "0.1.0",
        "model_id": config.model_id,
        "observe_only": config.observe_only,
        "fires_guns": False,
        "processes_payments": False,
    }


@app.get("/v1/feature-dictionary")
def feature_dictionary() -> Dict[str, Any]:
    from pathlib import Path
    import json

    path = Path(__file__).resolve().parent / "feature_dictionary.json"
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/v1/score", response_model=ScoreResponse)
def score_one(req: ScoreRequest) -> ScoreResponse:
    if req.persist and config.observe_only:
        raise HTTPException(
            status_code=403,
            detail="persist disabled while BANT_OBSERVE_ONLY=true; scores computed in-memory only",
        )
    result = scorer.score_one(
        silo_id=req.silo_id,
        cluster_id=req.cluster_id,
        features=req.features,
        jurisdiction_key=req.jurisdiction_key,
        persist=False,
    )
    payload = result.to_dict()
    payload["observe_only"] = config.observe_only
    # strip internal features_used from wire contract (available in batch debug if needed)
    payload.pop("features_used", None)
    return ScoreResponse(**payload)


@app.post("/v1/score/batch")
def score_batch(req: BatchScoreRequest) -> Dict[str, Any]:
    if req.persist and config.observe_only:
        raise HTTPException(
            status_code=403,
            detail="persist disabled while BANT_OBSERVE_ONLY=true",
        )
    items = [i.model_dump() for i in req.items]
    results = scorer.score_batch(silo_id=req.silo_id, items=items, persist=False)
    return {
        "silo_id": req.silo_id,
        "model_id": config.model_id,
        "count": len(results),
        "observe_only": config.observe_only,
        "scores": [
            {k: v for k, v in r.to_dict().items() if k != "features_used"}
            for r in results
        ],
    }


@app.get("/v1/integration")
def integration_contract() -> Dict[str, Any]:
    """Documents how BANT plugs into the omnichannel fabric — no side effects."""
    return {
        "role": "context_organ",
        "writes": ["bant.prospect_score", "bant.feature_snapshot", "bant.score_run"],
        "never_writes": [
            "raw.ncboe_donations",
            "core.di_donor_attribution",
            "brain.weapon_queue",
        ],
        "consumers": ["E59 microsegments", "E20 Brain GO features", "E68 Wizard", "E60 LP"],
        "fire_path": "NONE — ActionSocket / guns remain sole send path",
        "trigger_pattern": "extend ifttt.rules / brain.triggers to CALL bant score; do not create parallel catalogs",
        "dryrun_sql": "database/migrations/dryrun/DRYRUN_BANT_PROSPECT_SCORE_2026-08-02.sql",
        "canary": {
            "cluster_id": config.canary_cluster_id,
            "txns": config.canary_txn_count,
            "sum": config.canary_sum,
        },
    }
