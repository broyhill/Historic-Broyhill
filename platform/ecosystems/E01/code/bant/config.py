"""BANT configuration — env-driven, silo-aware, no secrets in code."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class BantConfig:
    """Runtime config for the BANT scoring service."""

    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://postgres@127.0.0.1:5432/postgres",
        )
    )
    model_id: str = field(
        default_factory=lambda: os.getenv("BANT_MODEL_ID", "bant_v0_experimental")
    )
    # Dimension weights for composite (must sum ~1.0)
    weight_budget: float = 0.30
    weight_authority: float = 0.20
    weight_need: float = 0.30
    weight_timing: float = 0.20
    # Tier cutoffs on composite 0–100
    tier_a_min: float = 75.0
    tier_b_min: float = 55.0
    tier_c_min: float = 35.0
    tier_d_min: float = 15.0
    # Service
    host: str = field(default_factory=lambda: os.getenv("BANT_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.getenv("BANT_PORT", "8491")))
    observe_only: bool = field(
        default_factory=lambda: os.getenv("BANT_OBSERVE_ONLY", "true").lower() == "true"
    )
    # Canary constants (never mutate)
    canary_cluster_id: int = 372171
    canary_txn_count: int = 147
    canary_sum: float = 332631.30

    def dimension_weights(self) -> Dict[str, float]:
        return {
            "budget": self.weight_budget,
            "authority": self.weight_authority,
            "need": self.weight_need,
            "timing": self.weight_timing,
        }

    def tier_for(self, composite: float) -> str:
        if composite >= self.tier_a_min:
            return "A"
        if composite >= self.tier_b_min:
            return "B"
        if composite >= self.tier_c_min:
            return "C"
        if composite >= self.tier_d_min:
            return "D"
        return "U"
