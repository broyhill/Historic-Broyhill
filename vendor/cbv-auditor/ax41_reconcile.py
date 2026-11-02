"""Facade for AX41 → e84.document_catalog reconcile. No third catalog."""
from __future__ import annotations

import sys
from pathlib import Path

_E84_CODE = Path(__file__).resolve().parents[1] / "ECO_CANONICAL" / "E84" / "code"
if str(_E84_CODE) not in sys.path:
    sys.path.insert(0, str(_E84_CODE))

from e84_ax41_reconcile import (  # noqa: E402, F401
    PG_TABLE,
    SQLITE_TABLE,
    ReconcileError,
    plan_reconcile,
    reconcile_ax41_to_postgres,
)
