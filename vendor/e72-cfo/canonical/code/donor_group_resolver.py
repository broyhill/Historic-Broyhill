#!/usr/bin/env python3
"""E72 Tier-1 — donor group resolution (Wizard-first S3).

Resolves campaign donor groups from race-relational / heat / grades / tags /
district tattoo signals into a stable group_id list for the 5Q → LP path.

Docs-only plane for now: pure functions, no executor, no sends.
Law: docs/canonical/ECO_IDENTITY_FREEZE_WIZARD_FIRST_2026-08-11.md
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class DonorGroup:
    group_id: str
    label: str
    source: str  # race_relational | heat | grade | tag | district_tattoo
    weight: float = 1.0
    member_count: int | None = None
    meta: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResolutionInput:
    """Signals available after Wizard 5Q (before LP)."""

    race_id: str | None = None
    district_keys: Sequence[str] = ()
    heat_segments: Sequence[str] = ()
    grade_bands: Sequence[str] = ()  # e.g. A++, A+, …
    tags: Sequence[str] = ()
    tattoo_keys: Sequence[str] = ()


def resolve_donor_groups(inp: ResolutionInput) -> list[DonorGroup]:
    """Tier-1 resolver: deterministic, explainable, no QoL full stack."""
    groups: list[DonorGroup] = []

    if inp.race_id:
        groups.append(
            DonorGroup(
                group_id=f"race:{inp.race_id}",
                label=f"Race relational · {inp.race_id}",
                source="race_relational",
                weight=1.0,
            )
        )

    for d in inp.district_keys:
        groups.append(
            DonorGroup(
                group_id=f"district:{d}",
                label=f"District tattoo · {d}",
                source="district_tattoo",
                weight=0.9,
            )
        )

    for h in inp.heat_segments:
        groups.append(
            DonorGroup(
                group_id=f"heat:{h}",
                label=f"Heat · {h}",
                source="heat",
                weight=0.85,
            )
        )

    for g in inp.grade_bands:
        groups.append(
            DonorGroup(
                group_id=f"grade:{g}",
                label=f"Grade band · {g}",
                source="grade",
                weight=0.8,
            )
        )

    for t in inp.tags:
        groups.append(
            DonorGroup(
                group_id=f"tag:{t}",
                label=f"Tag · {t}",
                source="tag",
                weight=0.7,
            )
        )

    # stable order by source priority then id
    priority = {
        "race_relational": 0,
        "district_tattoo": 1,
        "heat": 2,
        "grade": 3,
        "tag": 4,
    }
    groups.sort(key=lambda x: (priority.get(x.source, 9), x.group_id))
    return groups


def groups_to_dict(groups: Sequence[DonorGroup]) -> list[dict[str, Any]]:
    return [
        {
            "group_id": g.group_id,
            "label": g.label,
            "source": g.source,
            "weight": g.weight,
            "member_count": g.member_count,
            "meta": dict(g.meta),
        }
        for g in groups
    ]
