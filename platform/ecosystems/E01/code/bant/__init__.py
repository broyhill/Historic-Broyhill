"""
BANT — Behavioral Adaptive Nurture Targeting
============================================
Experimental prospect-scoring organ under E01 (Donor Intelligence).

Adapts classic BANT (Budget / Authority / Need / Timing) to BroyhillGOP:
  Budget    → giving capacity + history
  Authority → decision / household / bundler influence
  Need      → issue / heat / microsegment alignment to candidate
  Timing    → recency, cycle, fatigue headroom, news intensity

HARD RULES
  - Writes scores into schema `bant` only (dry-run DDL first).
  - Never calls gun adapters or ActionSocket FIRE.
  - Never writes sacred tables (raw.ncboe_donations, core.di_donor_attribution, …).
  - Consumers: E59 segments, E20 GO features, E68 Wizard display, E60 allocation inputs.
"""

from .scorer import BantScorer, BantScore, FeatureVector
from .config import BantConfig

__all__ = ["BantScorer", "BantScore", "FeatureVector", "BantConfig"]
__version__ = "0.1.0"
