"""
ecosystems/E61_cost_benefit_variance/orchestrator.py

Single cron entrypoint for all E61 background jobs.

Schedule (cron-style, all UTC):

    every 5 min   click_attribution_worker (E19 Social Bio)         — separate ecosystem, ref'd here for ops dashboard
    every  1 hr   variance_snapshotter                      — refresh dashboard data
    every  1 hr   anomaly_detector                          — emit variance_alert signals
    daily 06:00   daily_budget_allocator (per candidate)    — set today's allocation
    daily 06:30   throttle_evaluator                        — recompute automation_throttles
    weekly Sun    network_prior_recomputer                  — refresh hierarchical Bayesian priors
    every 30 min  expired_signal_cleaner                    — drop expired brain_signals

Invocation:
    python -m broyhillgop.ecosystems.E61_cost_benefit_variance.orchestrator JOB_NAME

Where JOB_NAME is one of: snapshot, anomaly, allocate, throttle, priors, cleanup, all
"""

# SEARCH-INDEX: ecosystem=E61 tier=orchestrator
# SEARCH-KEYWORDS: e61 orchestrator cron scheduler batch worker entrypoint


from __future__ import annotations

import argparse
import logging
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class JobResult:
    job: str
    success: bool
    duration_sec: float
    rows_processed: int = 0
    notes: str = ""


class E61Orchestrator:
    def __init__(
        self,
        db: Any,
        snapshotter,
        anomaly_detector,
        budget_allocator,
        throttle_evaluator,
        prior_recomputer,
    ):
        self.db = db
        self.snapshotter = snapshotter
        self.anomaly_detector = anomaly_detector
        self.budget_allocator = budget_allocator
        self.throttle_evaluator = throttle_evaluator
        self.prior_recomputer = prior_recomputer

    # ------ individual jobs --------------------------------------------------

    def job_snapshot(self) -> JobResult:
        t0 = time.perf_counter()
        n = self.snapshotter.snapshot_all()
        return JobResult("snapshot", True, time.perf_counter() - t0, rows_processed=n)

    def job_anomaly(self) -> JobResult:
        t0 = time.perf_counter()
        alerts = self.anomaly_detector.detect_and_emit()
        return JobResult(
            "anomaly", True, time.perf_counter() - t0,
            rows_processed=alerts,
            notes=f"{alerts} variance_alert signals emitted",
        )

    def job_allocate(self) -> JobResult:
        t0 = time.perf_counter()
        # Iterate active candidates with daily budgets configured
        cands = self.db.fetch_all(
            """
            SELECT candidate_id, daily_budget_cents, minimum_acceptable_roi
              FROM core.candidate_budget_config
             WHERE is_active
            """,
            {},
        )
        n = 0
        for c in cands:
            try:
                # Each candidate's allocator pulls their available actions
                self.budget_allocator.run_for_candidate(
                    candidate_id=uuid.UUID(str(c["candidate_id"])),
                    allocation_date=date.today(),
                    total_budget_cents=c["daily_budget_cents"],
                    minimum_acceptable_roi=float(c["minimum_acceptable_roi"]),
                )
                n += 1
            except Exception:
                logger.exception("budget allocation failed for candidate %s", c["candidate_id"])
        return JobResult("allocate", True, time.perf_counter() - t0, rows_processed=n)

    def job_throttle(self) -> JobResult:
        t0 = time.perf_counter()
        n = self.throttle_evaluator.evaluate_all()
        return JobResult("throttle", True, time.perf_counter() - t0, rows_processed=n)

    def job_priors(self) -> JobResult:
        t0 = time.perf_counter()
        n = self.prior_recomputer.recompute_all()
        return JobResult("priors", True, time.perf_counter() - t0, rows_processed=n)

    def job_cleanup(self) -> JobResult:
        t0 = time.perf_counter()
        # Remove expired unconsumed brain signals (older than 24h)
        result = self.db.fetch_one(
            """
            WITH d AS (
                DELETE FROM e61.brain_signals
                 WHERE consumed_at IS NULL AND expires_at < NOW()
                 RETURNING id
            )
            SELECT COUNT(*) AS n FROM d
            """,
            {},
        )
        return JobResult("cleanup", True, time.perf_counter() - t0,
                         rows_processed=result["n"] if result else 0)

    def job_all(self) -> list[JobResult]:
        results = []
        for job in ("snapshot", "anomaly", "allocate", "throttle", "priors", "cleanup"):
            try:
                results.append(getattr(self, f"job_{job}")())
            except Exception as e:
                logger.exception("job %s failed", job)
                results.append(JobResult(job, False, 0.0, notes=str(e)))
        return results


def main():
    p = argparse.ArgumentParser()
    p.add_argument("job", choices=["snapshot", "anomaly", "allocate", "throttle", "priors", "cleanup", "all"])
    p.add_argument("--dry-run", action="store_true", help="report what would run, don't execute")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.dry_run:
        logger.info("DRY-RUN: would execute job '%s'", args.job)
        sys.exit(0)

    # Production wiring (not in scaffold): instantiate db, snapshotter, etc.
    # then call orchestrator method. This main() is the entrypoint shape;
    # the platform's startup module wires the actual instances.
    logger.error(
        "orchestrator main() requires service wiring; "
        "instantiate E61Orchestrator(db, snapshotter, ...) in the platform startup module"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
