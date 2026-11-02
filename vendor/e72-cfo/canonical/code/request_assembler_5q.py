#!/usr/bin/env python3
"""E72 Tier-1 — 5Q → LP input assembler (Wizard-first S3).

Assembles a Campaign Plan Object *input* bundle for E60/E72 LP from Wizard 5Q
answers + resolved donor groups. No executor enable. No FIRE.

Law: docs/canonical/ECO_IDENTITY_FREEZE_WIZARD_FIRST_2026-08-11.md
E87 remains C/B/V only — do not fold into E60 here.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Sequence

from donor_group_resolver import DonorGroup, ResolutionInput, resolve_donor_groups


@dataclass
class FiveQAnswers:
    """Wizard of Oz 5Q (intent surface)."""

    who: str  # candidate / committee
    what: str  # ask / goal
    when: str  # window
    where: str  # geography
    why: str  # narrative / issue heat


@dataclass
class LpInputBundle:
    """Inputs the LP / investment engine consumes — not a send order."""

    schema: str = "e72.lp_input_bundle.v1"
    five_q: Mapping[str, str] = field(default_factory=dict)
    donor_groups: list[dict[str, Any]] = field(default_factory=list)
    constraints: Mapping[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def assemble_lp_inputs(
    answers: FiveQAnswers,
    resolution: ResolutionInput | None = None,
    *,
    budget_ceiling: float | None = None,
    channel_caps: Mapping[str, int] | None = None,
) -> LpInputBundle:
    groups: list[DonorGroup] = []
    if resolution is not None:
        groups = resolve_donor_groups(resolution)

    constraints: dict[str, Any] = {
        "sends_enabled": False,  # hard — assembler never arms guns
        "e87_role": "cbv_only",
    }
    if budget_ceiling is not None:
        constraints["budget_ceiling"] = budget_ceiling
    if channel_caps:
        constraints["channel_caps"] = dict(channel_caps)

    return LpInputBundle(
        five_q={
            "who": answers.who,
            "what": answers.what,
            "when": answers.when,
            "where": answers.where,
            "why": answers.why,
        },
        donor_groups=[
            {
                "group_id": g.group_id,
                "label": g.label,
                "source": g.source,
                "weight": g.weight,
            }
            for g in groups
        ],
        constraints=constraints,
        notes=[
            "Tier-1 assembler — docs/code plane only",
            "Between 5Q and LP: groups resolved; full QoL not required",
        ],
    )


def bundle_to_dict(bundle: LpInputBundle) -> dict[str, Any]:
    return asdict(bundle)
