"""Native propensities → LP coefficients (not Iterable Nova SaaS)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class PropensityVector:
    engage_user_id: str
    brand_affinity_label: Optional[str] = None  # loyal|neutral|at-risk|negative|unscored
    p_engage: Optional[float] = None
    preferred_channel: Optional[str] = None
    send_time_slot: Optional[str] = None
    frequency_cap: Optional[int] = None

    def as_lp_coefficients(self) -> dict:
        """Shape for E60 LP coefficient ingest.

        # CORRECTION 2026-10-04: Re-mapped decision ecosystem from E19 to E60 per core registry
        """
        return {
            "engage_user_id": self.engage_user_id,
            "affinity": self.brand_affinity_label,
            "p_engage": self.p_engage,
            "channel": self.preferred_channel,
            "send_time": self.send_time_slot,
            "fatigue_cap": self.frequency_cap,
            "source": "bgop_engage.propensities",
            "vendor_saas": False,
        }


def merge_from_e01(
    engage_user_id: str,
    *,
    intensity: Optional[float] = None,
    temperature: Optional[str] = None,
) -> PropensityVector:
    """Bridge E01 signals into Engage propensity vector (native)."""
    return PropensityVector(
        engage_user_id=engage_user_id,
        brand_affinity_label=temperature,
        p_engage=intensity,
    )
