"""
ecosystems/E61_cost_benefit_variance/ml/attribution_resolver.py

Links benefit events back to upstream cost events through attribution chains.

Runs after each benefit event lands. Models supported:
    last_touch  — 100% credit to most recent action in window (default for direct response)
    linear      — equal split across all actions in window
    time_decay  — exponential decay weights toward most recent
    markov      — removal-effects via Markov chain (periodic batch only)

Channels marked direct_response use last_touch always.
Awareness channels (rare in BroyhillGOP) use markov.

Attribution lookback windows (days):
    donation:        30
    rsvp:             7
    volunteer:       14
    sign_request:    14
"""

# SEARCH-INDEX: ecosystem=E61 tier=ml
# SEARCH-KEYWORDS: e61 attribution last-touch linear time-decay markov attribution-chain


from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


LOOKBACK_DAYS = {
    "donation": 30,
    "rsvp": 7,
    "volunteer_signup": 14,
    "sign_request": 14,
    "yard_sign_placed": 14,
    "followup_scheduled": 7,
}

DIRECT_RESPONSE_DEFAULT = True   # most BroyhillGOP channels are direct response


class AttributionResolver:
    def __init__(self, db: Any):
        self.db = db

    def resolve_benefit(
        self,
        benefit_id: uuid.UUID,
        attribution_model: str = "last_touch",
        time_decay_halflife_days: float = 7.0,
    ) -> list[uuid.UUID]:
        """
        Resolve a single benefit to its attribution chain.
        Returns list of attribution_chain row ids written.
        """
        benefit = self.db.fetch_one(
            """
            SELECT id, candidate_id, benefit_type, observed_at, value_cents,
                   contact_id, rncid, source_table, source_id
              FROM e61.action_benefits
             WHERE id = %(id)s
            """,
            {"id": str(benefit_id)},
        )
        if not benefit:
            logger.warning("benefit %s not found", benefit_id)
            return []

        lookback = LOOKBACK_DAYS.get(benefit["benefit_type"], 30)
        window_start = benefit["observed_at"] - timedelta(days=lookback)

        # Find candidate cost events within the window.
        # Match on contact_id (preferred) or rncid (fallback).
        candidate_costs = self.db.fetch_all(
            """
            SELECT ac.id, ac.emitted_at, ac.total_cost_cents,
                   ac.action_type, ac.ecosystem_code,
                   ac.source_table, ac.source_id
              FROM e61.action_costs ac
             WHERE ac.candidate_id = %(cand)s
               AND ac.emitted_at BETWEEN %(start)s AND %(observed)s
               AND (
                   -- match by contact_id via source row
                   EXISTS (
                       SELECT 1 FROM e19_dm.dm_dispatched dm
                        WHERE ac.source_table = 'e19_dm.dm_dispatched'
                          AND ac.source_id = dm.id
                          AND EXISTS (
                              SELECT 1 FROM e19_dm.comment_events ce
                               WHERE ce.id = dm.comment_event_id
                                 AND (ce.resolved_contact_id = %(contact)s
                                      OR ce.resolved_rncid = %(rncid)s)
                          )
                   )
                   -- bio link clicks
                   OR EXISTS (
                       SELECT 1 FROM e19_bio.bio_link_clicks bc
                        WHERE ac.source_table = 'e19_bio.bio_link_clicks'
                          AND ac.source_id = bc.id
                          AND (bc.resolved_contact_id = %(contact)s
                               OR bc.resolved_rncid = %(rncid)s)
                   )
                   -- inbox messages
                   OR EXISTS (
                       SELECT 1 FROM e36.external_messages em
                        WHERE ac.source_table = 'e36.external_messages'
                          AND ac.source_id = em.id
                          AND (em.resolved_contact_id = %(contact)s
                               OR em.resolved_rncid = %(rncid)s)
                   )
               )
             ORDER BY ac.emitted_at DESC
            """,
            {
                "cand": str(benefit["candidate_id"]),
                "start": window_start,
                "observed": benefit["observed_at"],
                "contact": str(benefit["contact_id"]) if benefit["contact_id"] else None,
                "rncid": benefit["rncid"],
            },
        )

        if not candidate_costs:
            logger.info("benefit %s has no upstream costs in lookback window", benefit_id)
            return []

        # Compute weights per attribution model
        weights = self._compute_weights(
            candidate_costs,
            benefit["observed_at"],
            attribution_model,
            time_decay_halflife_days,
        )

        # Persist chain rows
        chain_ids = []
        for cost_row, weight in weights:
            attributed_value = int(round(benefit["value_cents"] * weight))
            row = self.db.fetch_one(
                """
                INSERT INTO e61.attribution_chains (
                    candidate_id, benefit_id, cost_id,
                    attribution_model, attribution_weight,
                    attributed_value_cents, lookback_days
                ) VALUES (
                    %(cand)s, %(bid)s, %(cid)s,
                    %(model)s, %(weight)s,
                    %(value)s, %(lookback)s
                )
                RETURNING id
                """,
                {
                    "cand": str(benefit["candidate_id"]),
                    "bid": str(benefit_id),
                    "cid": str(cost_row["id"]),
                    "model": attribution_model,
                    "weight": weight,
                    "value": attributed_value,
                    "lookback": lookback,
                },
            )
            chain_ids.append(uuid.UUID(str(row["id"])))

        logger.info(
            "benefit %s attributed to %d cost events under model=%s",
            benefit_id, len(chain_ids), attribution_model,
        )
        return chain_ids

    # -- weight computation --------------------------------------------------

    def _compute_weights(
        self,
        cost_rows: list[dict],
        benefit_time: datetime,
        model: str,
        halflife_days: float,
    ) -> list[tuple[dict, float]]:
        if not cost_rows:
            return []

        if model == "last_touch":
            # 100% to most recent (cost_rows already DESC by emitted_at)
            return [(cost_rows[0], 1.0)]

        if model == "linear":
            n = len(cost_rows)
            return [(r, 1.0 / n) for r in cost_rows]

        if model == "time_decay":
            raw_weights = []
            for r in cost_rows:
                age_days = (benefit_time - r["emitted_at"]).total_seconds() / 86400
                w = 0.5 ** (age_days / halflife_days)
                raw_weights.append((r, w))
            total = sum(w for _, w in raw_weights)
            if total == 0:
                return [(cost_rows[0], 1.0)]
            return [(r, w / total) for r, w in raw_weights]

        if model == "markov":
            # Markov removal-effects requires aggregate transition probabilities
            # estimated from full historical data — too expensive to compute
            # per-benefit. This branch should be invoked only by batch jobs
            # using pre-computed transition matrices. Fall back to time_decay
            # for online use.
            logger.info("markov requested in online path; falling back to time_decay")
            return self._compute_weights(cost_rows, benefit_time, "time_decay", halflife_days)

        raise ValueError(f"unknown attribution model: {model}")
