# E72 Tier-1 — donor groups + 5Q→LP assembler (Wizard-first S3)

**Status:** code landed 2026-08-11 (Cursor)  
**Law:** `docs/canonical/ECO_IDENTITY_FREEZE_WIZARD_FIRST_2026-08-11.md`

| File | Role |
|---|---|
| `ECO_CANONICAL/E72/code/donor_group_resolver.py` | Resolve race/heat/grade/tag/district groups |
| `ECO_CANONICAL/E72/code/request_assembler_5q.py` | Assemble `e72.lp_input_bundle.v1` from 5Q |

HARD: `sends_enabled=false` in constraints. No executor. E87 = C/B/V only.
