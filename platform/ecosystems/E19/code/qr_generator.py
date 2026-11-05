"""
ecosystems/E19_social/bio/qr_generator.py

Generates QR codes for E14/E18/E33 print runs.
Each QR carries a short token (e.g. ?q=Ax9k2P) that maps to a print run row,
enabling per-mailer attribution all the way through to donation.

Token strategy:
    - 8-character base62 token (62^8 ≈ 218 trillion combinations)
    - Cryptographically random
    - Stored in e19_bio.qr_print_runs with UNIQUE constraint
    - URL: https://bio.broyhillgop.com/{slug}?q={token}

Cost emission: once at print run creation, allocated across quantity_printed.
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social qr-code token print e14 e18 e33 attribution


from __future__ import annotations

import logging
import secrets
import string
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


_BASE62 = string.ascii_letters + string.digits


@dataclass
class QRPrintRunSpec:
    candidate_id: uuid.UUID
    print_ecosystem: str         # 'E14' | 'E18' | 'E33'
    bio_link_slug: str           # which link the QR resolves to
    quantity_printed: int
    cost_per_unit_cents: int
    notes: str | None = None


@dataclass
class QRGenerationResult:
    print_run_id: uuid.UUID
    qr_token: str
    bio_url: str


class QRGenerator:
    def __init__(self, db: Any, cost_emitter, base_url: str = "https://bio.broyhillgop.com"):
        self.db = db
        self.cost_emitter = cost_emitter
        self.base_url = base_url.rstrip("/")

    def create_print_run(self, spec: QRPrintRunSpec) -> QRGenerationResult:
        # Resolve bio_page slug from candidate
        page = self.db.fetch_one(
            """
            SELECT p.id AS page_id, p.slug,
                   l.id AS link_id
              FROM e19_bio.bio_pages p
              LEFT JOIN e19_bio.bio_links l
                ON l.bio_page_id = p.id AND l.link_slug = %(ls)s
             WHERE p.candidate_id = %(cand)s AND p.is_active
             ORDER BY p.created_at DESC
             LIMIT 1
            """,
            {"cand": str(spec.candidate_id), "ls": spec.bio_link_slug},
        )
        if not page:
            raise RuntimeError(f"no active bio page for candidate {spec.candidate_id}")

        token = self._generate_unique_token()

        row = self.db.fetch_one(
            """
            INSERT INTO e19_bio.qr_print_runs (
                candidate_id, print_ecosystem, bio_link_id,
                print_run_date, quantity_printed, cost_per_unit_cents,
                qr_token, notes
            ) VALUES (
                %(cand)s, %(eco)s, %(link)s,
                CURRENT_DATE, %(qty)s, %(cpu)s,
                %(token)s, %(notes)s
            )
            RETURNING id
            """,
            {
                "cand": str(spec.candidate_id),
                "eco": spec.print_ecosystem,
                "link": str(page["link_id"]) if page["link_id"] else None,
                "qty": spec.quantity_printed,
                "cpu": spec.cost_per_unit_cents,
                "token": token,
                "notes": spec.notes,
            },
        )
        run_id = uuid.UUID(str(row["id"]))

        # Emit cost — full print run cost charged at creation time
        total_cost_cents = spec.quantity_printed * spec.cost_per_unit_cents
        try:
            cost_action = {
                "E14": "print_e14_run",
                "E18": "print_e18_run",
                "E33": "direct_mail_lob",
            }.get(spec.print_ecosystem, "print_run_generic")
            self.cost_emitter.emit_cost(
                ecosystem_code=spec.print_ecosystem,
                action_type=cost_action,
                source_table="e19_bio.qr_print_runs",
                source_id=run_id,
                units=spec.quantity_printed,
                idempotency_key=f"qr_run:{run_id}",
            )
        except Exception:
            logger.exception("cost emission failed for QR print run %s", run_id)

        bio_url = f"{self.base_url}/{page['slug']}?q={token}"
        return QRGenerationResult(print_run_id=run_id, qr_token=token, bio_url=bio_url)

    def render_qr_png(self, bio_url: str, size: int = 600) -> bytes:
        """
        Returns PNG bytes for the QR code.
        Production: use qrcode library. Scaffold: stub.
        """
        try:
            import qrcode
            from io import BytesIO
            img = qrcode.make(bio_url, box_size=max(1, size // 30))
            buf = BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
        except ImportError:
            logger.warning("qrcode library not installed; returning empty bytes")
            return b""

    @staticmethod
    def _generate_unique_token(length: int = 8) -> str:
        return "".join(secrets.choice(_BASE62) for _ in range(length))
