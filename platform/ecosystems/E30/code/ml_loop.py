"""E30 ML feedback loop + E22 What's Working integration.

Closes the loop: every send's outcome (open, click, convert, bounce)
feeds back into:
  1. Send-time optimisation — per-recipient optimal hour/day
  2. Content scoring — which subject lines/bodies perform for which segments
  3. E22 experiment tracking — attribute conversions to variations
  4. Engagement prediction — predictive unsubscribe/churn scoring
  5. Template re-ranking — surface top performers, retire losers

This replaces the legacy SendTimeOptimizer (which only tracked open
hour) with a multi-signal learning system.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("e30.ml_loop")


# ---------------------------------------------------------------------------
# Send-time optimiser (per-recipient)
# ---------------------------------------------------------------------------

@dataclass
class SendTimeProfile:
    """Per-recipient send-time learning."""
    email: str
    hour_counts: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    day_counts: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    total_opens: int = 0
    avg_response_hours: float = 4.0

    @property
    def best_hour(self) -> int:
        if not self.hour_counts:
            return 10  # default 10 AM
        return max(self.hour_counts, key=self.hour_counts.get)

    @property
    def best_day(self) -> int:
        if not self.day_counts:
            return 2  # default Wednesday
        return max(self.day_counts, key=self.day_counts.get)


class SendTimeOptimiser:
    """Learn optimal send times from open behaviour."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool
        self._cache: Dict[str, SendTimeProfile] = {}

    def record_open(self, email: str, sent_at: datetime, opened_at: datetime) -> None:
        """Record an open event to update the profile."""
        profile = self._cache.get(email, SendTimeProfile(email=email))
        profile.hour_counts[opened_at.hour] += 1
        profile.day_counts[opened_at.weekday()] += 1
        profile.total_opens += 1
        response_h = (opened_at - sent_at).total_seconds() / 3600
        profile.avg_response_hours = (
            (profile.avg_response_hours * (profile.total_opens - 1) + response_h)
            / profile.total_opens
        )
        self._cache[email] = profile
        self._persist(profile)

    def get_optimal(self, email: str) -> Dict[str, Any]:
        """Get optimal send time for a recipient."""
        if email in self._cache:
            p = self._cache[email]
            return {
                "has_data": True,
                "best_hour": p.best_hour,
                "best_day": p.best_day,
                "avg_response_hours": round(p.avg_response_hours, 1),
                "total_opens": p.total_opens,
            }
        if self._pool:
            return self._load_from_db(email)
        return {"has_data": False, "best_hour": 10, "best_day": 2,
                "avg_response_hours": 4.0, "total_opens": 0}

    def _persist(self, profile: SendTimeProfile) -> None:
        if not self._pool:
            return
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO e30.send_time_profiles
                           (email, best_hour, best_day, avg_response_hours, total_opens)
                           VALUES (%s, %s, %s, %s, %s)
                           ON CONFLICT (email) DO UPDATE SET
                               best_hour = EXCLUDED.best_hour,
                               best_day = EXCLUDED.best_day,
                               avg_response_hours = EXCLUDED.avg_response_hours,
                               total_opens = EXCLUDED.total_opens,
                               updated_at = NOW()""",
                        (profile.email, profile.best_hour, profile.best_day,
                         profile.avg_response_hours, profile.total_opens),
                    )
                conn.commit()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
        except Exception as exc:
            logger.error("Send-time persist failed: %s", exc)

    def _load_from_db(self, email: str) -> Dict[str, Any]:
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT best_hour, best_day, avg_response_hours, total_opens
                           FROM e30.send_time_profiles WHERE email = %s""",
                        (email,),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if row:
                return {
                    "has_data": True,
                    "best_hour": row[0],
                    "best_day": row[1],
                    "avg_response_hours": float(row[2] or 4.0),
                    "total_opens": row[3] or 0,
                }
        except Exception as exc:
            logger.error("Send-time load failed: %s", exc)
        return {"has_data": False, "best_hour": 10, "best_day": 2,
                "avg_response_hours": 4.0, "total_opens": 0}


# ---------------------------------------------------------------------------
# Content scorer (subject line + body performance)
# ---------------------------------------------------------------------------

@dataclass
class ContentPerformance:
    """Aggregate performance for a content fingerprint."""
    fingerprint: str
    sends: int = 0
    opens: int = 0
    clicks: int = 0
    conversions: int = 0
    revenue_cents: int = 0

    @property
    def open_rate(self) -> float:
        return self.opens / self.sends if self.sends > 0 else 0.0

    @property
    def click_rate(self) -> float:
        return self.clicks / self.opens if self.opens > 0 else 0.0

    @property
    def conversion_rate(self) -> float:
        return self.conversions / self.sends if self.sends > 0 else 0.0

    @property
    def revenue_per_send_cents(self) -> float:
        return self.revenue_cents / self.sends if self.sends > 0 else 0.0

    def score(self) -> float:
        """Composite content score (0-1).  Weights:
        open_rate 0.3, click_rate 0.3, conversion_rate 0.3, sample_size 0.1."""
        sample_bonus = min(1.0, math.log1p(self.sends) / math.log1p(1000))
        return (
            0.3 * min(1.0, self.open_rate / 0.30) +
            0.3 * min(1.0, self.click_rate / 0.10) +
            0.3 * min(1.0, self.conversion_rate / 0.05) +
            0.1 * sample_bonus
        )


class ContentScorer:
    """Track and score content performance."""

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def top_subject_lines(self, candidate_id: Optional[str] = None,
                          limit: int = 10) -> List[ContentPerformance]:
        """Return top-performing subject lines."""
        if not self._pool:
            return []
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT subject_line,
                                  COUNT(*) AS sends,
                                  COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS opens,
                                  COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL) AS clicks,
                                  COUNT(*) FILTER (WHERE conversion_cents > 0) AS conversions,
                                  COALESCE(SUM(conversion_cents), 0) AS revenue
                           FROM e30.send_log
                           WHERE delivered = TRUE
                             AND (%s IS NULL OR candidate_id = %s)
                           GROUP BY subject_line
                           HAVING COUNT(*) >= 20
                           ORDER BY COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL)::FLOAT
                                    / GREATEST(COUNT(*), 1) DESC
                           LIMIT %s""",
                        (candidate_id, candidate_id, limit),
                    )
                    results = []
                    for row in cur.fetchall():
                        results.append(ContentPerformance(
                            fingerprint=row[0] or "",
                            sends=row[1], opens=row[2], clicks=row[3],
                            conversions=row[4], revenue_cents=row[5],
                        ))
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            return results
        except Exception as exc:
            logger.error("Top subject lines query failed: %s", exc)
            return []


# ---------------------------------------------------------------------------
# E22 integration (What's Working)
# ---------------------------------------------------------------------------

class E22Bridge:
    """Bridge E30 send outcomes to E22 experiment tracking.

    When a send has experiment_id and variation_id, the bridge
    reports the outcome as an E22 event so the A/B/Infinity engine
    can measure which variation won.
    """

    def __init__(self, e22_enabled: bool = True):
        self._enabled = e22_enabled
        self._tracker = None
        self._event_store = None
        if e22_enabled:
            try:
                from ecosystems.e22_whats_working.event_tracker import (
                    EventTracker, EventStore,
                )
                self._event_store = EventStore()
                self._tracker = EventTracker(event_store=self._event_store)
            except (ImportError, TypeError):
                logger.info("E22 event_tracker not wired (no DB); bridge in stub mode")
                self._enabled = False

    def report_send(self, send_id: str, experiment_id: Optional[str],
                    variation_id: Optional[str], donor_id: str) -> None:
        """Report a successful send as an E22 exposure event."""
        if not self._enabled or not experiment_id or not self._tracker:
            return
        try:
            from decimal import Decimal
            self._tracker.track(
                donor_id=int(donor_id) if donor_id.isdigit() else 0,
                event_key="email_sent",
                event_value=Decimal("1"),
                metadata={"send_id": send_id, "source": "E30",
                           "experiment_id": experiment_id,
                           "variation_id": variation_id},
            )
        except Exception as exc:
            logger.error("E22 send report failed: %s", exc)

    def report_conversion(self, send_id: str, experiment_id: Optional[str],
                          variation_id: Optional[str], donor_id: str,
                          revenue_cents: int = 0) -> None:
        """Report a conversion (donation after email click) to E22."""
        if not self._enabled or not experiment_id or not self._tracker:
            return
        try:
            from decimal import Decimal
            self._tracker.track(
                donor_id=int(donor_id) if donor_id.isdigit() else 0,
                event_key="email_conversion",
                event_value=Decimal(str(revenue_cents)) / Decimal("100"),
                metadata={"send_id": send_id, "source": "E30",
                           "experiment_id": experiment_id,
                           "variation_id": variation_id},
            )
        except Exception as exc:
            logger.error("E22 conversion report failed: %s", exc)


# ---------------------------------------------------------------------------
# Engagement predictor (churn/unsubscribe risk)
# ---------------------------------------------------------------------------

@dataclass
class EngagementScore:
    """Per-recipient engagement health."""
    email: str
    score: float = 50.0  # 0-100, higher is more engaged
    total_sent: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    last_opened_at: Optional[datetime] = None
    last_clicked_at: Optional[datetime] = None
    churn_risk: str = "medium"  # low, medium, high

    @property
    def open_rate(self) -> float:
        return self.total_opened / self.total_sent if self.total_sent > 0 else 0.0

    @property
    def click_rate(self) -> float:
        return self.total_clicked / self.total_opened if self.total_opened > 0 else 0.0


class EngagementPredictor:
    """Predict unsubscribe/churn risk based on engagement patterns."""

    DECAY_DAYS = 90  # score decays if no opens in 90 days

    def __init__(self, db_pool: Any = None):
        self._pool = db_pool

    def score(self, email: str) -> EngagementScore:
        """Calculate engagement score for a recipient."""
        if not self._pool:
            return EngagementScore(email=email)
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT
                               COUNT(*) AS total_sent,
                               COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL) AS opened,
                               COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL) AS clicked,
                               MAX(first_opened_at) AS last_opened,
                               MAX(first_clicked_at) AS last_clicked
                           FROM e30.send_log
                           WHERE recipient_email = %s AND delivered = TRUE""",
                        (email,),
                    )
                    row = cur.fetchone()
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
            if not row or row[0] == 0:
                return EngagementScore(email=email, churn_risk="high")

            total_sent, opened, clicked, last_open, last_click = row
            open_rate = opened / total_sent if total_sent > 0 else 0.0
            click_rate = clicked / opened if opened > 0 else 0.0

            # Base score from rates
            base = (open_rate * 60) + (click_rate * 30)

            # Recency bonus/penalty
            now = datetime.now(timezone.utc)
            if last_open:
                if not last_open.tzinfo:
                    last_open = last_open.replace(tzinfo=timezone.utc)
                days_since = (now - last_open).days
                if days_since < 7:
                    base += 10
                elif days_since > self.DECAY_DAYS:
                    base -= 20
            else:
                base -= 15

            raw_score = max(0.0, min(100.0, base))
            if raw_score >= 60:
                risk = "low"
            elif raw_score >= 30:
                risk = "medium"
            else:
                risk = "high"

            return EngagementScore(
                email=email,
                score=round(raw_score, 1),
                total_sent=total_sent,
                total_opened=opened,
                total_clicked=clicked,
                last_opened_at=last_open,
                last_clicked_at=last_click,
                churn_risk=risk,
            )
        except Exception as exc:
            logger.error("Engagement score failed: %s", exc)
            return EngagementScore(email=email)

    def high_churn_list(self, limit: int = 500) -> List[str]:
        """Return emails at high churn risk (candidates for reactivation)."""
        if not self._pool:
            return []
        try:
            conn = self._pool.getconn() if hasattr(self._pool, "getconn") else self._pool
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT recipient_email
                           FROM e30.send_log
                           WHERE delivered = TRUE
                           GROUP BY recipient_email
                           HAVING COUNT(*) >= 5
                              AND COUNT(*) FILTER (WHERE first_opened_at IS NOT NULL)::FLOAT
                                  / COUNT(*) < 0.05
                           ORDER BY MAX(sent_at) ASC
                           LIMIT %s""",
                        (limit,),
                    )
                    return [row[0] for row in cur.fetchall()]
            finally:
                if hasattr(self._pool, "putconn"):
                    self._pool.putconn(conn)
        except Exception as exc:
            logger.error("High churn list query failed: %s", exc)
            return []
