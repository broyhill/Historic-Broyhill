"""
ecosystems/E19_social/bio/e33_integration.py

Helper that E33 (Direct Mail / Lob) calls when setting up a print run
that includes a QR code pointing to a candidate's bio page.

Flow:
    1. E33 mailer composer is set up — Lob template, recipient list, etc.
    2. Before submitting to Lob, E33 calls register_qr_for_print_run()
    3. We allocate a QR token, write e19_bio.qr_print_runs row, return URL + image
    4. E33 embeds the QR image into the Lob template
    5. Lob ships, E33 marks print run shipped (calls mark_print_run_shipped())
    6. Each scan flows through bio_renderer with ?q={token} → attribution chain

Cost emission:
    - At register time we emit ZERO cost (no print yet)
    - At mark_shipped time we emit cost = quantity * cost_per_unit_cents
    - This matches accounting (you only pay when Lob prints)
"""

# SEARCH-INDEX: ecosystem=E19_social tier=integration
# SEARCH-KEYWORDS: e19_social e33 e14 e18 mailer lob print-run integration


from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any

from .qr_generator import QRGenerator, QRPrintRunSpec, QRGenerationResult

logger = logging.getLogger(__name__)

BIO_PUBLIC_HOST = os.environ.get("BIO_PUBLIC_HOST", "bio.broyhillgop.com")


@dataclass
class PrintRunRegistration:
    print_run_id: uuid.UUID
    qr_token: str
    bio_url: str
    qr_image_bytes: bytes              # PNG
    qr_image_format: str = "png"


class E33Integration:
    def __init__(self, db: Any, qr_generator: QRGenerator, cost_emitter):
        self.db = db
        self.qr = qr_generator
        self.cost = cost_emitter

    def register_qr_for_print_run(
        self,
        *,
        candidate_id: uuid.UUID,
        print_ecosystem: str,           # 'E14' | 'E18' | 'E33'
        bio_link_slug: str,
        quantity_printed: int,
        cost_per_unit_cents: int,
        notes: str | None = None,
    ) -> PrintRunRegistration:
        """
        Called by E33/E14/E18 before sending to Lob.
        Returns the QR token, public URL, and PNG bytes for the mailer template.
        """
        # Look up the candidate's bio page slug + verify the link exists
        bio_meta = self.db.fetch_one(
            """
            SELECT p.slug, l.id AS bio_link_id
              FROM e19_bio.bio_pages p
              LEFT JOIN e19_bio.bio_links l
                ON l.bio_page_id = p.id AND l.link_slug = %(ls)s
             WHERE p.candidate_id = %(cand)s
               AND p.is_active
             LIMIT 1
            """,
            {"cand": str(candidate_id), "ls": bio_link_slug},
        )
        if not bio_meta:
            raise ValueError(
                f"no active bio page for candidate {candidate_id} — "
                f"silo provisioning incomplete; cannot register QR print run"
            )
        if not bio_meta.get("bio_link_id"):
            raise ValueError(
                f"bio link slug '{bio_link_slug}' not configured for candidate {candidate_id}; "
                f"add the link via /candidate/bio/links before generating QR"
            )

        # Generate QR
        spec = QRPrintRunSpec(
            candidate_id=candidate_id,
            print_ecosystem=print_ecosystem,
            bio_link_slug=bio_link_slug,
            quantity_printed=quantity_printed,
            cost_per_unit_cents=cost_per_unit_cents,
            notes=notes,
        )
        result: QRGenerationResult = self.qr.generate(spec, bio_slug=bio_meta["slug"])

        # Persist print run row
        run_row = self.db.fetch_one(
            """
            INSERT INTO e19_bio.qr_print_runs (
                candidate_id, print_ecosystem, bio_link_id,
                print_run_date, quantity_printed, cost_per_unit_cents,
                qr_token, notes
            ) VALUES (
                %(cand)s, %(eco)s, %(blink)s,
                CURRENT_DATE, %(qty)s, %(cpu)s,
                %(tok)s, %(notes)s
            )
            RETURNING id
            """,
            {
                "cand": str(candidate_id),
                "eco": print_ecosystem,
                "blink": str(bio_meta["bio_link_id"]),
                "qty": quantity_printed,
                "cpu": cost_per_unit_cents,
                "tok": result.qr_token,
                "notes": notes,
            },
        )
        run_id = uuid.UUID(str(run_row["id"]))
        logger.info(
            "registered QR print run %s: %s pieces in %s, token=%s",
            run_id, quantity_printed, print_ecosystem, result.qr_token,
        )

        return PrintRunRegistration(
            print_run_id=run_id,
            qr_token=result.qr_token,
            bio_url=result.bio_url,
            qr_image_bytes=result.qr_image_bytes,
        )

    def mark_print_run_shipped(self, print_run_id: uuid.UUID) -> None:
        """
        Called by E33 after Lob confirms shipment. Emits cost to E61.
        Idempotent — safe to call multiple times (cost emitter dedupes on key).
        """
        run = self.db.fetch_one(
            """
            SELECT candidate_id, print_ecosystem, quantity_printed, cost_per_unit_cents
              FROM e19_bio.qr_print_runs
             WHERE id = %(id)s
            """,
            {"id": str(print_run_id)},
        )
        if not run:
            raise ValueError(f"print run {print_run_id} not found")

        total_cost = run["quantity_printed"] * run["cost_per_unit_cents"]

        self.cost.emit_cost(
            ecosystem_code=run["print_ecosystem"],
            action_type=f"direct_mail_lob",   # rate card lookup uses E33/direct_mail_lob etc.
            source_table="e19_bio.qr_print_runs",
            source_id=print_run_id,
            units=run["quantity_printed"],
            segment={
                "qr_attributed": True,
                "ecosystem_origin": run["print_ecosystem"],
            },
            idempotency_key=f"e19_social:bio:qr_run_shipped:{print_run_id}",
        )
        logger.info(
            "emitted print cost: run=%s qty=%s total=%s cents",
            print_run_id, run["quantity_printed"], total_cost,
        )
