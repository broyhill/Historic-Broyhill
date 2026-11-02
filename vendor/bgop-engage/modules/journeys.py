"""Journey tiles — native (not Iterable Journey Studio SaaS)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TileType(str, Enum):
    START = "start"
    MESSAGE = "message"
    DELAY = "delay"
    FILTER = "filter"
    USER_UPDATE = "user_update"
    INTEGRATION = "integration"  # call Brain/LP — not a vendor


@dataclass
class JourneyTile:
    tile_id: str
    tile_type: TileType
    config: Dict[str, Any] = field(default_factory=dict)
    next_tile_ids: List[str] = field(default_factory=list)


@dataclass
class Journey:
    journey_id: str
    name: str
    candidate_id: str
    tiles: List[JourneyTile] = field(default_factory=list)
    enabled: bool = False


def validate_journey(journey: Journey) -> List[str]:
    """Return list of problems; empty = ok."""
    problems: List[str] = []
    if not journey.tiles:
        problems.append("no_tiles")
    types = {t.tile_type for t in journey.tiles}
    if TileType.START not in types:
        problems.append("missing_start")
    return problems
