"""
ecosystems/E19_social/bio/bio_renderer.py

Renders the public bio page and logs every click event.

Routes (mounted under E55 API Gateway):
    GET  /bio/{slug}                → render page
    POST /bio/{slug}/click          → log click, redirect to target_url

Click logging is fire-and-forget from the user's perspective:
    - 302 redirect returned within ~50ms
    - Cost event emitted async to E61
    - Identity resolution runs async (resolved_contact_id populated later)
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social page-renderer public-view click-tracking redirect attribution


from __future__ import annotations

import hashlib
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class BioPageRenderRequest:
    slug: str
    qr_token: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None


@dataclass
class BioPageData:
    candidate_id: uuid.UUID
    page_title: str
    page_subtitle: str | None
    profile_photo_url: str | None
    theme_overrides: dict
    links: list[dict]


class BioRenderer:
    def __init__(self, db: Any, cost_emitter, daily_ip_salt: bytes | None = None):
        self.db = db
        self.cost_emitter = cost_emitter
        # Daily salt for IP hashing — rotates each day to prevent long-term tracking.
        # Production: pull from KMS / vault. Scaffold: env or generated.
        self._daily_salt = daily_ip_salt or os.urandom(16)

    def render(self, req: BioPageRenderRequest) -> BioPageData | None:
        page_row = self.db.fetch_one(
            """
            SELECT id, candidate_id, page_title, page_subtitle,
                   profile_photo_asset_id, theme_overrides
              FROM e19_bio.bio_pages
             WHERE slug = %(slug)s AND is_active = TRUE
            """,
            {"slug": req.slug},
        )
        if not page_row:
            return None

        link_rows = self.db.fetch_all(
            """
            SELECT id, link_slug, display_label, icon_name, target_url,
                   link_type, attribution_code, sort_order
              FROM e19_bio.bio_links
             WHERE bio_page_id = %(pid)s
               AND is_active = TRUE
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at > NOW())
             ORDER BY sort_order
            """,
            {"pid": str(page_row["id"])},
        )

        return BioPageData(
            candidate_id=uuid.UUID(str(page_row["candidate_id"])),
            page_title=page_row["page_title"],
            page_subtitle=page_row["page_subtitle"],
            profile_photo_url=self._asset_url(page_row["profile_photo_asset_id"]),
            theme_overrides=page_row["theme_overrides"] or {},
            links=[dict(r) for r in link_rows],
        )

    def log_click_and_redirect(
        self,
        *,
        slug: str,
        link_slug: str | None,
        client_ip: str,
        user_agent: str | None,
        referrer: str | None,
        utm: dict,
        qr_token: str | None,
    ) -> str | None:
        """
        Logs the click, emits cost to E61, returns redirect URL (or None for 404).
        """
        page = self.db.fetch_one(
            "SELECT id, candidate_id FROM e19_bio.bio_pages WHERE slug = %(slug)s AND is_active",
            {"slug": slug},
        )
        if not page:
            return None

        # If link_slug provided, look up the target URL with attribution stamp
        target_url = None
        link_id = None
        attribution_code = None
        link_type = None
        if link_slug:
            link = self.db.fetch_one(
                """
                SELECT id, target_url, attribution_code, link_type
                  FROM e19_bio.bio_links
                 WHERE bio_page_id = %(pid)s AND link_slug = %(ls)s
                   AND is_active = TRUE
                """,
                {"pid": str(page["id"]), "ls": link_slug},
            )
            if link:
                link_id = link["id"]
                attribution_code = link["attribution_code"]
                link_type = link["link_type"]
                target_url = self._stamp_attribution(link["target_url"], attribution_code)

        # Resolve QR source if qr_token present
        qr_source = None
        qr_print_run_id = None
        if qr_token:
            qr = self.db.fetch_one(
                """
                SELECT id, print_ecosystem
                  FROM e19_bio.qr_print_runs
                 WHERE qr_token = %(t)s
                """,
                {"t": qr_token},
            )
            if qr:
                qr_source = f"qr_{qr['print_ecosystem'].lower()}"
                qr_print_run_id = qr["id"]

        # Hash IP with daily salt
        ip_hash = hashlib.sha256(self._daily_salt + (client_ip or "").encode("utf-8")).digest()

        # Insert click row
        click_row = self.db.fetch_one(
            """
            INSERT INTO e19_bio.bio_link_clicks (
                candidate_id, bio_page_id, bio_link_id,
                ip_hash, user_agent, referrer,
                utm_source, utm_medium, utm_campaign,
                qr_source, qr_print_run_id
            ) VALUES (
                %(cand)s, %(pid)s, %(lid)s,
                %(ip)s, %(ua)s, %(ref)s,
                %(us)s, %(um)s, %(uc)s,
                %(qsrc)s, %(qrun)s
            )
            RETURNING id
            """,
            {
                "cand": str(page["candidate_id"]),
                "pid": str(page["id"]),
                "lid": str(link_id) if link_id else None,
                "ip": ip_hash,
                "ua": user_agent,
                "ref": referrer,
                "us": utm.get("source"),
                "um": utm.get("medium"),
                "uc": utm.get("campaign"),
                "qsrc": qr_source,
                "qrun": str(qr_print_run_id) if qr_print_run_id else None,
            },
        )
        click_id = uuid.UUID(str(click_row["id"]))

        # Emit cost event for the page render itself (cheap but real)
        try:
            cost_id = self.cost_emitter.emit_cost(
                ecosystem_code="E19_social",
                action_type="render_bio_page",
                source_table="e19_bio.bio_link_clicks",
                source_id=click_id,
                units=1,
                segment={
                    "qr_source": qr_source,
                    "link_type": link_type,
                },
                idempotency_key=f"e19_social:bio:click:{click_id}",
            )
            self.db.execute(
                "UPDATE e19_bio.bio_link_clicks SET cost_event_id = %(c)s WHERE id = %(id)s",
                {"c": str(cost_id), "id": str(click_id)},
            )
        except Exception:
            logger.exception("cost emission failed for click %s; click row preserved", click_id)

        return target_url or self._default_url_for_page(slug)

    # -- helpers -------------------------------------------------------------

    def _stamp_attribution(self, url: str, attribution_code: str | None) -> str:
        if not attribution_code:
            return url
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}attribution={attribution_code}"

    def _default_url_for_page(self, slug: str) -> str:
        return f"/bio/{slug}"

    def _asset_url(self, asset_id) -> str | None:
        if not asset_id:
            return None
        # Production: resolve via E08 communications library asset CDN
        return f"/assets/{asset_id}"
