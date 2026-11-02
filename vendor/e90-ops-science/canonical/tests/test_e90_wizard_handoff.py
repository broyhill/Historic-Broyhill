import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
sys.path.insert(0, str(PYTHON_DIR))

from e90_wizard_handoff import (  # noqa: E402
    AuthorizationReceipt,
    ImplementationClass,
    RecommendationClass,
    RecommendationRef,
    route_authorized_recommendation,
)


NOW = datetime(2026, 9, 3, tzinfo=timezone.utc)


def recommendation(**overrides):
    values = {
        "recommendation_id": "r-1",
        "recommendation_version": "v1",
        "recommendation_sha256": "a" * 64,
        "recommendation_class": RecommendationClass.QUEUE_POLICY_EFFICIENCY,
        "implementation_class": ImplementationClass.QUEUE_POLICY,
        "tenant_id": None,
        "candidate_id": None,
        "e72_plan_ref": None,
        "expires_at": NOW + timedelta(hours=1),
    }
    values.update(overrides)
    return RecommendationRef(**values)


def authorization(rec, **overrides):
    values = {
        "authorization_id": "a-1",
        "recommendation_id": rec.recommendation_id,
        "recommendation_version": rec.recommendation_version,
        "recommendation_sha256": rec.recommendation_sha256,
        "tenant_id": rec.tenant_id,
        "candidate_id": rec.candidate_id,
        "expires_at": NOW + timedelta(minutes=30),
    }
    values.update(overrides)
    return AuthorizationReceipt(**values)


class WizardHandoffTests(unittest.TestCase):
    def test_queue_change_becomes_work_order_not_direct_mutation(self):
        rec = recommendation()
        result = route_authorized_recommendation(rec, authorization(rec), now=NOW)
        self.assertEqual(result.route, "IMPLEMENTATION_WORK_ORDER")

    def test_external_action_stops_at_preview(self):
        rec = recommendation(
            implementation_class=ImplementationClass.EXTERNAL_ACTION
        )
        result = route_authorized_recommendation(rec, authorization(rec), now=NOW)
        self.assertEqual(result.route, "ACTION_SOCKET_PREVIEW")

    def test_campaign_recommendation_requires_e72_plan(self):
        rec = recommendation(
            recommendation_class=RecommendationClass.CAMPAIGN_PLAN_EFFICIENCY,
            implementation_class=ImplementationClass.CAMPAIGN_PLAN_INPUT,
        )
        with self.assertRaises(ValueError):
            route_authorized_recommendation(rec, authorization(rec), now=NOW)

    def test_exact_hash_mismatch_is_rejected(self):
        rec = recommendation()
        auth = authorization(rec, recommendation_sha256="b" * 64)
        with self.assertRaises(ValueError):
            route_authorized_recommendation(rec, auth, now=NOW)

    def test_revoked_authorization_is_rejected(self):
        rec = recommendation()
        with self.assertRaises(ValueError):
            route_authorized_recommendation(
                rec,
                authorization(rec, revoked=True),
                now=NOW,
            )

    def test_consumed_authorization_is_rejected(self):
        rec = recommendation()
        with self.assertRaises(ValueError):
            route_authorized_recommendation(
                rec,
                authorization(rec, consumed=True),
                now=NOW,
            )

    def test_expired_recommendation_is_rejected(self):
        rec = recommendation(expires_at=NOW - timedelta(seconds=1))
        with self.assertRaises(ValueError):
            route_authorized_recommendation(rec, authorization(rec), now=NOW)


if __name__ == "__main__":
    unittest.main()
