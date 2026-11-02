"""
ecosystems/E61_cost_benefit_variance/brain/brain_consumer.py

Contract that E20 Central Brain calls to consume E61 signals.

E20 polls this every N seconds (or LISTEN/NOTIFYs in production). The
consumer atomically marks signals consumed_at + consumed_by, returning
them in batches. SKIP LOCKED ensures multiple E20 worker pods don't
double-consume.

Usage from E20:

    from broyhillgop.ecosystems.E61_cost_benefit_variance.brain.brain_consumer \
        import E61BrainConsumer

    consumer = E61BrainConsumer(db, consumer_name='e20_main_loop')
    while True:
        batch = consumer.poll(batch_size=100)
        for signal in batch:
            e20_decide(signal)
        time.sleep(5)
"""

# SEARCH-INDEX: ecosystem=E61 tier=brain
# SEARCH-KEYWORDS: e61 brain-consumer e20 polling listen-notify atomic-consume


from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ConsumedSignal:
    id: uuid.UUID
    candidate_id: uuid.UUID
    signal_type: str
    payload: dict
    emitted_at: Any


class E61BrainConsumer:
    """
    The contract E20 uses to consume E61 brain signals.
    Atomic, idempotent, multi-worker safe.
    """

    def __init__(
        self,
        db: Any,
        consumer_name: str = "e20_brain",
        signal_types_filter: list[str] | None = None,
    ):
        self.db = db
        self.consumer_name = consumer_name
        self.filter = signal_types_filter   # None = all types

    def poll(
        self,
        batch_size: int = 100,
        candidate_id: uuid.UUID | None = None,
    ) -> list[ConsumedSignal]:
        """
        Atomically consume up to batch_size signals.
        Returns empty list when nothing pending.
        """
        params = {
            "consumer": self.consumer_name,
            "lim": batch_size,
        }
        cand_filter = ""
        if candidate_id:
            cand_filter = "AND candidate_id = %(cand)s"
            params["cand"] = str(candidate_id)
        type_filter = ""
        if self.filter:
            type_filter = "AND signal_type = ANY(%(types)s)"
            params["types"] = self.filter

        rows = self.db.fetch_all(
            f"""
            UPDATE e61.brain_signals
               SET consumed_at = NOW(),
                   consumed_by = %(consumer)s
             WHERE id IN (
                SELECT id FROM e61.brain_signals
                 WHERE consumed_at IS NULL
                   AND expires_at > NOW()
                   {cand_filter}
                   {type_filter}
                 ORDER BY emitted_at ASC
                 LIMIT %(lim)s
                 FOR UPDATE SKIP LOCKED
             )
            RETURNING id, candidate_id, signal_type, payload, emitted_at
            """,
            params,
        )

        return [
            ConsumedSignal(
                id=uuid.UUID(str(r["id"])),
                candidate_id=uuid.UUID(str(r["candidate_id"])),
                signal_type=r["signal_type"],
                payload=r["payload"],
                emitted_at=r["emitted_at"],
            )
            for r in rows
        ]

    def peek(self, limit: int = 20, candidate_id: uuid.UUID | None = None) -> list[dict]:
        """
        Read without consuming — for dashboards and debugging.
        """
        params = {"lim": limit}
        cand_filter = ""
        if candidate_id:
            cand_filter = "AND candidate_id = %(cand)s"
            params["cand"] = str(candidate_id)

        return [
            dict(r) for r in self.db.fetch_all(
                f"""
                SELECT id, candidate_id, signal_type, payload,
                       emitted_at, consumed_at, consumed_by, expires_at
                  FROM e61.brain_signals
                 WHERE consumed_at IS NULL
                   AND expires_at > NOW()
                   {cand_filter}
                 ORDER BY emitted_at DESC
                 LIMIT %(lim)s
                """,
                params,
            )
        ]

    def acknowledge(self, signal_id: uuid.UUID, outcome: str) -> None:
        """
        E20 reports back what it did with a signal (for audit).
        Outcome values: 'applied', 'rejected', 'queued', 'noop'
        Stored on the row in payload.consumption_outcome.
        """
        self.db.execute(
            """
            UPDATE e61.brain_signals
               SET payload = payload || jsonb_build_object('consumption_outcome', %(o)s)
             WHERE id = %(id)s
            """,
            {"id": str(signal_id), "o": outcome},
        )
