"""Ask / event catalog — native collections (not Iterable Catalog SaaS)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CatalogItem:
    item_id: str
    item_type: str  # ask|event|content
    title: str
    payload: Dict[str, Any] = field(default_factory=dict)
    active: bool = True


class Catalog:
    def __init__(self):
        self._items: Dict[str, CatalogItem] = {}

    def upsert(self, item: CatalogItem) -> CatalogItem:
        self._items[item.item_id] = item
        return item

    def match(self, *, item_type: Optional[str] = None, limit: int = 20) -> List[CatalogItem]:
        out = [i for i in self._items.values() if i.active]
        if item_type:
            out = [i for i in out if i.item_type == item_type]
        return out[:limit]
