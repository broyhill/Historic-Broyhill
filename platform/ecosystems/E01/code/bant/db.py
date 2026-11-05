"""Optional Postgres repository for BANT — writes only to schema `bant`."""

from __future__ import annotations

import json
from typing import Any, Optional

from .features import FeatureVector
from .scorer import BantScore


class BantRepository:
    def __init__(self, conn: Any):
        self.conn = conn

    def save_score(self, score: BantScore, fv: FeatureVector) -> int:
        cur = self.conn.cursor()
        cur.execute(
            """
            INSERT INTO bant.feature_snapshot
              (silo_id, cluster_id, model_id, features_json, source_hash)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (silo_id, cluster_id, model_id, source_hash)
            DO UPDATE SET computed_at = NOW()
            RETURNING snapshot_id
            """,
            (
                score.silo_id,
                score.cluster_id,
                score.model_id,
                json.dumps(fv.to_json()),
                fv.source_hash(),
            ),
        )
        snapshot_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO bant.prospect_score (
              silo_id, cluster_id, model_id, snapshot_id,
              budget_score, authority_score, need_score, timing_score,
              bant_composite, p_act, expected_amount, tier,
              reason_vector, microsegment_hints, jurisdiction_key, opponent_safe
            ) VALUES (
              %s,%s,%s,%s,
              %s,%s,%s,%s,
              %s,%s,%s,%s,
              %s::jsonb,%s,%s,%s
            )
            ON CONFLICT (silo_id, cluster_id, model_id) DO UPDATE SET
              snapshot_id = EXCLUDED.snapshot_id,
              budget_score = EXCLUDED.budget_score,
              authority_score = EXCLUDED.authority_score,
              need_score = EXCLUDED.need_score,
              timing_score = EXCLUDED.timing_score,
              bant_composite = EXCLUDED.bant_composite,
              p_act = EXCLUDED.p_act,
              expected_amount = EXCLUDED.expected_amount,
              tier = EXCLUDED.tier,
              reason_vector = EXCLUDED.reason_vector,
              microsegment_hints = EXCLUDED.microsegment_hints,
              jurisdiction_key = EXCLUDED.jurisdiction_key,
              opponent_safe = EXCLUDED.opponent_safe,
              scored_at = NOW()
            RETURNING score_id
            """,
            (
                score.silo_id,
                score.cluster_id,
                score.model_id,
                snapshot_id,
                score.budget_score,
                score.authority_score,
                score.need_score,
                score.timing_score,
                score.bant_composite,
                score.p_act,
                score.expected_amount,
                score.tier,
                json.dumps(score.reason_vector),
                score.microsegment_hints,
                score.jurisdiction_key,
                score.opponent_safe,
            ),
        )
        score_id = cur.fetchone()[0]
        self.conn.commit()
        return int(score_id)

    def start_run(
        self,
        model_id: str,
        silo_id: Optional[str],
        mode: str,
        request_json: dict,
        canary_open: Optional[str] = None,
    ) -> int:
        cur = self.conn.cursor()
        cur.execute(
            """
            INSERT INTO bant.score_run
              (model_id, silo_id, mode, request_json, canary_open)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            RETURNING run_id
            """,
            (model_id, silo_id, mode, json.dumps(request_json), canary_open),
        )
        run_id = cur.fetchone()[0]
        self.conn.commit()
        return int(run_id)

    def finish_run(
        self,
        run_id: int,
        row_count: int,
        status: str,
        canary_close: Optional[str] = None,
        error_text: Optional[str] = None,
    ) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            UPDATE bant.score_run
            SET finished_at = NOW(),
                row_count = %s,
                status = %s,
                canary_close = %s,
                error_text = %s
            WHERE run_id = %s
            """,
            (row_count, status, canary_close, error_text, run_id),
        )
        self.conn.commit()
