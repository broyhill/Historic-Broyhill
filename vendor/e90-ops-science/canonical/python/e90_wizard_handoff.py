"""E90 recommendation handoff to E68 Wizard and E20.

This module performs contract and authorization checks. It does not dispatch,
write to a database, or call an external system.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum


class RecommendationClass(str, Enum):
    CAMPAIGN_PLAN_EFFICIENCY = "CAMPAIGN_PLAN_EFFICIENCY"
    QUEUE_POLICY_EFFICIENCY = "QUEUE_POLICY_EFFICIENCY"
    CAPACITY_INVESTMENT = "CAPACITY_INVESTMENT"
    DATA_QUALITY_EFFICIENCY = "DATA_QUALITY_EFFICIENCY"
    MODEL_RECALIBRATION = "MODEL_RECALIBRATION"
    CONFIGURATION_CHANGE = "CONFIGURATION_CHANGE"
    CODE_SCHEMA_DEPLOYMENT = "CODE_SCHEMA_DEPLOYMENT"
    ADVISORY_ONLY = "ADVISORY_ONLY"


class ImplementationClass(str, Enum):
    ADVISORY = "ADVISORY"
    CAMPAIGN_PLAN_INPUT = "CAMPAIGN_PLAN_INPUT"
    QUEUE_POLICY = "QUEUE_POLICY"
    CONFIGURATION = "CONFIGURATION"
    CODE = "CODE"
    SCHEMA = "SCHEMA"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    EXTERNAL_ACTION = "EXTERNAL_ACTION"


@dataclass(frozen=True)
class RecommendationRef:
    recommendation_id: str
    recommendation_version: str
    recommendation_sha256: str
    recommendation_class: RecommendationClass
    implementation_class: ImplementationClass
    tenant_id: str | None
    candidate_id: str | None
    e72_plan_ref: str | None
    expires_at: datetime


@dataclass(frozen=True)
class AuthorizationReceipt:
    authorization_id: str
    recommendation_id: str
    recommendation_version: str
    recommendation_sha256: str
    tenant_id: str | None
    candidate_id: str | None
    expires_at: datetime
    revoked: bool = False
    consumed: bool = False


@dataclass(frozen=True)
class E20RouteDecision:
    route: str
    reason: str


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamps must be timezone-aware")
    return value.astimezone(timezone.utc)


def validate_authorization(
    recommendation: RecommendationRef,
    authorization: AuthorizationReceipt,
    *,
    now: datetime | None = None,
) -> None:
    now = _utc(now or datetime.now(timezone.utc))
    if _utc(recommendation.expires_at) <= now:
        raise ValueError("recommendation is expired")
    if _utc(authorization.expires_at) <= now:
        raise ValueError("authorization is expired")
    if authorization.revoked:
        raise ValueError("authorization is revoked")
    if authorization.consumed:
        raise ValueError("authorization is already consumed")
    expected = (
        recommendation.recommendation_id,
        recommendation.recommendation_version,
        recommendation.recommendation_sha256,
        recommendation.tenant_id,
        recommendation.candidate_id,
    )
    actual = (
        authorization.recommendation_id,
        authorization.recommendation_version,
        authorization.recommendation_sha256,
        authorization.tenant_id,
        authorization.candidate_id,
    )
    if actual != expected:
        raise ValueError("authorization does not bind the exact recommendation and scope")
    if (
        recommendation.recommendation_class
        is RecommendationClass.CAMPAIGN_PLAN_EFFICIENCY
        and not recommendation.e72_plan_ref
    ):
        raise ValueError("campaign efficiency requires an E72 plan reference")


def route_authorized_recommendation(
    recommendation: RecommendationRef,
    authorization: AuthorizationReceipt,
    *,
    now: datetime | None = None,
) -> E20RouteDecision:
    """Return the only permitted next route after exact-version authorization."""

    validate_authorization(recommendation, authorization, now=now)
    route_by_class = {
        ImplementationClass.ADVISORY: (
            "ADVISORY_RECORDED",
            "Record the recommendation; no implementation or execution.",
        ),
        ImplementationClass.CAMPAIGN_PLAN_INPUT: (
            "E20_CAMPAIGN_GATE",
            "Recheck the E72 plan and current state before any Socket request.",
        ),
        ImplementationClass.QUEUE_POLICY: (
            "IMPLEMENTATION_WORK_ORDER",
            "Route to the registered queue owner; do not modify the queue directly.",
        ),
        ImplementationClass.CONFIGURATION: (
            "IMPLEMENTATION_WORK_ORDER",
            "Route through governed configuration change control.",
        ),
        ImplementationClass.CODE: (
            "IMPLEMENTATION_WORK_ORDER",
            "Route through engineering review and deployment controls.",
        ),
        ImplementationClass.SCHEMA: (
            "IMPLEMENTATION_WORK_ORDER",
            "Route through database change control and separate authorization.",
        ),
        ImplementationClass.INFRASTRUCTURE: (
            "IMPLEMENTATION_WORK_ORDER",
            "Route through infrastructure change control and separate authorization.",
        ),
        ImplementationClass.EXTERNAL_ACTION: (
            "ACTION_SOCKET_PREVIEW",
            "Only PREVIEW is eligible here; FIRE requires all fresh E20 and Socket gates.",
        ),
    }
    route, reason = route_by_class[recommendation.implementation_class]
    return E20RouteDecision(route=route, reason=reason)

