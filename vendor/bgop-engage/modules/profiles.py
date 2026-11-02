"""Engagement profiles — native (not Iterable Users API)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional


@dataclass
class EngageProfile:
    engage_user_id: str
    candidate_id: str
    cluster_id: Optional[int] = None
    email: Optional[str] = None  # optional; prefer de-ID ops
    attributes: Dict[str, Any] = field(default_factory=dict)
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ProfileStore:
    """In-memory / DB-backed profile store. DB writes require applied engage schema."""

    def __init__(self, db_conn=None):
        self.db_conn = db_conn
        self._mem: Dict[str, EngageProfile] = {}

    def upsert(self, profile: EngageProfile) -> EngageProfile:
        profile.updated_at = datetime.now(timezone.utc).isoformat()
        if self.db_conn is None:
            self._mem[profile.engage_user_id] = profile
            return profile
        cur = self.db_conn.cursor()
        cur.execute(
            """
            INSERT INTO engage.profiles (
              engage_user_id, candidate_id, cluster_id, email, attributes, updated_at
            ) VALUES (%s, %s, %s, %s, %s::jsonb, NOW())
            ON CONFLICT (engage_user_id) DO UPDATE SET
              candidate_id = EXCLUDED.candidate_id,
              cluster_id = EXCLUDED.cluster_id,
              email = EXCLUDED.email,
              attributes = EXCLUDED.attributes,
              updated_at = NOW()
            """,
            (
                profile.engage_user_id,
                profile.candidate_id,
                profile.cluster_id,
                profile.email,
                __import__("json").dumps(profile.attributes),
            ),
        )
        self.db_conn.commit()
        return profile

    def get(self, engage_user_id: str) -> Optional[EngageProfile]:
        if self.db_conn is None:
            return self._mem.get(engage_user_id)
        cur = self.db_conn.cursor()
        cur.execute(
            "SELECT engage_user_id, candidate_id, cluster_id, email, attributes "
            "FROM engage.profiles WHERE engage_user_id = %s",
            (engage_user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return EngageProfile(
            engage_user_id=row[0],
            candidate_id=str(row[1]),
            cluster_id=row[2],
            email=row[3],
            attributes=row[4] or {},
        )
