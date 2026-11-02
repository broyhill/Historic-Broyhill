"""
ecosystems/E61_cost_benefit_variance/automation/throttle_reader.py

Contract that E40 Automation Control calls to read E61 throttle decisions.

Every action emission in any ecosystem must call this BEFORE dispatching:

    decision = throttle_reader.check(candidate_id, ecosystem, action_type)
    if decision.state == 'pause':
        # do not emit
    elif decision.state == 'reduce':
        # apply rate limit
    elif decision.state in ('full', 'expand'):
        # full speed ahead

Throttle states:
    full   — execute up to candidate's daily ceiling
    reduce — execute at half ceiling (default reduction; configurable)
    pause  — block emission entirely
    expand — request ceiling increase (E40 routes to candidate's manager)

The reader caches throttle states for 60 seconds to keep hot-path
decisions fast. Cache invalidates on Postgres NOTIFY 'e61_throttle_changed'.
"""

# SEARCH-INDEX: ecosystem=E61 tier=automation
# SEARCH-KEYWORDS: e61 throttle-reader e40 cache enforce decision-point


from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


CACHE_TTL_SEC = 60


@dataclass
class ThrottleDecision:
    state: str                         # full | reduce | pause | expand
    daily_ceiling_cents: int | None    # absolute cap, None = no cap
    rationale: str | None
    set_at: Any
    set_by: str | None


class ThrottleReader:
    """
    Used by every ecosystem's emit path. Cheap, cached, thread-safe.
    """

    def __init__(self, db: Any):
        self.db = db
        self._cache: dict[tuple, tuple[float, ThrottleDecision]] = {}
        self._cache_lock = threading.RLock()

    def check(
        self,
        *,
        candidate_id: uuid.UUID,
        ecosystem_code: str,
        action_type: str,
    ) -> ThrottleDecision:
        key = (str(candidate_id), ecosystem_code, action_type)

        # Check cache
        now = time.time()
        with self._cache_lock:
            cached = self._cache.get(key)
            if cached and (now - cached[0]) < CACHE_TTL_SEC:
                return cached[1]

        # Read from DB
        row = self.db.fetch_one(
            """
            SELECT throttle_state, daily_ceiling_usd_cents, rationale, set_at, set_by, expires_at
              FROM e61.automation_throttles
             WHERE candidate_id = %(cand)s
               AND ecosystem_code = %(eco)s
               AND action_type = %(at)s
            """,
            {
                "cand": str(candidate_id),
                "eco": ecosystem_code,
                "at": action_type,
            },
        )

        if row is None or self._is_expired(row):
            # Default: full throttle (no row → not yet evaluated by E61)
            decision = ThrottleDecision(
                state="full",
                daily_ceiling_cents=None,
                rationale="default (no throttle set)",
                set_at=None,
                set_by=None,
            )
        else:
            decision = ThrottleDecision(
                state=row["throttle_state"],
                daily_ceiling_cents=row["daily_ceiling_usd_cents"],
                rationale=row["rationale"],
                set_at=row["set_at"],
                set_by=row["set_by"],
            )

        with self._cache_lock:
            self._cache[key] = (now, decision)

        return decision

    def invalidate(
        self,
        candidate_id: uuid.UUID | None = None,
        ecosystem_code: str | None = None,
        action_type: str | None = None,
    ) -> None:
        """
        Force cache invalidation. Called on NOTIFY or on staff override.
        With no args, clears entire cache.
        """
        with self._cache_lock:
            if not any([candidate_id, ecosystem_code, action_type]):
                self._cache.clear()
                return
            keys_to_clear = []
            for k in self._cache:
                if (
                    (candidate_id is None or k[0] == str(candidate_id))
                    and (ecosystem_code is None or k[1] == ecosystem_code)
                    and (action_type is None or k[2] == action_type)
                ):
                    keys_to_clear.append(k)
            for k in keys_to_clear:
                self._cache.pop(k, None)

    def daily_spend_remaining(
        self,
        *,
        candidate_id: uuid.UUID,
        ecosystem_code: str,
        action_type: str,
        spend_today_cents: int | None = None,
    ) -> int | None:
        """
        Returns remaining daily budget in cents, or None if no ceiling set.
        Pulls live spend if not provided.
        """
        decision = self.check(
            candidate_id=candidate_id,
            ecosystem_code=ecosystem_code,
            action_type=action_type,
        )
        if decision.daily_ceiling_cents is None:
            return None

        if spend_today_cents is None:
            row = self.db.fetch_one(
                """
                SELECT COALESCE(SUM(total_cost_cents), 0)::INT AS spent
                  FROM e61.action_costs
                 WHERE candidate_id = %(cand)s
                   AND ecosystem_code = %(eco)s
                   AND action_type = %(at)s
                   AND emitted_at >= CURRENT_DATE
                """,
                {
                    "cand": str(candidate_id),
                    "eco": ecosystem_code,
                    "at": action_type,
                },
            )
            spend_today_cents = row["spent"] if row else 0

        return max(0, decision.daily_ceiling_cents - spend_today_cents)

    def _is_expired(self, row: dict) -> bool:
        from datetime import datetime, timezone
        exp = row.get("expires_at")
        if exp is None:
            return False
        if isinstance(exp, str):
            return False
        return exp < datetime.now(timezone.utc) if exp.tzinfo else exp < datetime.utcnow()


class ThrottleEvaluator:
    """
    Periodically (default daily 06:30) evaluates current variance state and
    sets throttle states automatically.

    Rules:
        - lower CI bound on ROI < 0.5x        → pause
        - lower CI bound on ROI 0.5x to 1.0x  → reduce
        - lower CI bound on ROI 1.0x to 2.0x  → full
        - lower CI bound on ROI > 2.0x with confidence_tier=very_high → expand
    """

    def __init__(self, db: Any, brain_emitter):
        self.db = db
        self.brain = brain_emitter

    def evaluate_all(self) -> int:
        # Pull most-recent variance snapshot per (candidate, action, segment)
        rows = self.db.fetch_all(
            """
            SELECT DISTINCT ON (candidate_id, action_type, segment_key)
                   candidate_id, action_type, segment_dims,
                   n, mean_roi, stddev_roi, ci_95_lower, ci_95_upper,
                   confidence_tier
              FROM e61.variance_snapshots
             WHERE snapshot_at > NOW() - INTERVAL '6 hours'
             ORDER BY candidate_id, action_type, segment_key, snapshot_at DESC
            """,
            {},
        )

        changes = 0
        for r in rows:
            try:
                new_state = self._decide_state(r)
                if new_state and self._upsert_throttle(r, new_state):
                    changes += 1
            except Exception:
                logger.exception("throttle eval failed for %s", r.get("action_type"))

        logger.info("throttle_evaluator made %d changes", changes)
        return changes

    def _decide_state(self, r: dict) -> str | None:
        ci_lo = float(r["ci_95_lower"]) if r["ci_95_lower"] is not None else 0.0
        tier = r["confidence_tier"]

        if ci_lo < 0.5:
            return "pause"
        elif ci_lo < 1.0:
            return "reduce"
        elif ci_lo > 2.0 and tier == "very_high":
            return "expand"
        else:
            return "full"

    def _upsert_throttle(self, r: dict, new_state: str) -> bool:
        # Ecosystem code is implicit in action_type prefix or looked up
        # via cost_rate_card. For scaffold: derive from action_type.
        ecosystem_code = self._action_to_ecosystem(r["action_type"])
        rationale = (
            f"auto: ci_lo={r['ci_95_lower']} tier={r['confidence_tier']} n={r['n']}"
        )
        result = self.db.fetch_one(
            """
            INSERT INTO e61.automation_throttles (
                candidate_id, ecosystem_code, action_type, throttle_state,
                rationale, set_by, set_at
            ) VALUES (
                %(cand)s, %(eco)s, %(at)s, %(state)s,
                %(why)s, 'e61_auto', NOW()
            )
            ON CONFLICT (candidate_id, ecosystem_code, action_type) DO UPDATE
               SET throttle_state = EXCLUDED.throttle_state,
                   rationale      = EXCLUDED.rationale,
                   set_by         = EXCLUDED.set_by,
                   set_at         = NOW()
             WHERE automation_throttles.throttle_state IS DISTINCT FROM EXCLUDED.throttle_state
                OR automation_throttles.set_by IS DISTINCT FROM 'e61_auto'
            RETURNING id
            """,
            {
                "cand": str(r["candidate_id"]),
                "eco": ecosystem_code,
                "at": r["action_type"],
                "state": new_state,
                "why": rationale,
            },
        )
        if not result:
            return False  # no change

        # Emit recommendation signal so E20 can also react
        self.brain.emit_throttle_recommendation(
            candidate_id=uuid.UUID(str(r["candidate_id"])),
            ecosystem_code=ecosystem_code,
            action_type=r["action_type"],
            new_state=new_state,
            rationale=rationale,
        )
        return True

    @staticmethod
    def _action_to_ecosystem(action_type: str) -> str:
        # Production: cost_rate_card lookup. Scaffold: rule-based.
        prefix_map = {
            "send_dm_": "E19_social",
            "render_bio_page": "E19_social",
            "direct_mail_": "E33",
            "send_sms_": "E31",
            "rvm_": "E47",
            "call_": "E32",
            "email_": "E30",
        }
        for prefix, eco in prefix_map.items():
            if action_type.startswith(prefix) or action_type == prefix.rstrip("_"):
                return eco
        return "UNKNOWN"
