"""
ecosystems/E19_social/bio/routes.py

HTTP route handlers for E19 Social Bio link-in-bio.

Mounted into E55 API Gateway. Three routes:

    GET  /bio/{slug}                — render public bio page (HTML)
    GET  /bio/{slug}/click/{link_slug}  — log click, 302 redirect to target
    GET  /bio/{slug}.json            — render bio page (JSON, for headless clients)

The click endpoint is a GET (not POST) because users follow links from QR
scans and from social media — must be safe to follow without preflight.
We log fire-and-forget (worker pool) so redirect latency stays under 50ms.
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social routes http fastapi e55 endpoints redirect


from __future__ import annotations

import logging
import urllib.parse
from typing import Any

from fastapi import APIRouter, Header, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

logger = logging.getLogger(__name__)


def build_router(
    bio_renderer,
    template_engine,        # something with .render(name, **ctx) -> str
    click_worker_pool,      # something with .submit(callable, **kwargs)
    candidate_branding_lookup,  # callable: candidate_id -> dict of brand kit
) -> APIRouter:
    """
    Returns a FastAPI APIRouter the parent app mounts under whatever prefix
    E55 chooses (typically "" — these routes serve the public bio domain).
    """
    router = APIRouter()

    @router.get("/bio/{slug}", response_class=HTMLResponse)
    def render_bio_page(
        slug: str,
        request: Request,
        q: str | None = None,                  # QR token
        utm_source: str | None = None,
        utm_medium: str | None = None,
        utm_campaign: str | None = None,
    ):
        from .bio_renderer import BioPageRenderRequest
        page_data = bio_renderer.render(BioPageRenderRequest(
            slug=slug, qr_token=q,
            utm_source=utm_source, utm_medium=utm_medium, utm_campaign=utm_campaign,
        ))
        if not page_data:
            return HTMLResponse(_render_404(), status_code=404)

        # Log a page-view click row (no link clicked yet) so we have impression data
        click_worker_pool.submit(
            bio_renderer.log_click_and_redirect,
            slug=slug,
            link_slug=None,
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            utm={"source": utm_source, "medium": utm_medium, "campaign": utm_campaign},
            qr_token=q,
        )

        # Pull candidate branding for theme
        branding = candidate_branding_lookup(page_data.candidate_id) or {}

        # Render via template engine
        html = template_engine.render(
            "bio_page.html",
            page=page_data,
            branding=branding,
            slug=slug,
            qr_token=q,
        )
        # Tight cache: 60s public — bio editing should reflect quickly
        return HTMLResponse(html, headers={"Cache-Control": "public, max-age=60"})

    @router.get("/bio/{slug}.json", response_class=JSONResponse)
    def render_bio_page_json(slug: str):
        from .bio_renderer import BioPageRenderRequest
        page_data = bio_renderer.render(BioPageRenderRequest(slug=slug))
        if not page_data:
            return JSONResponse({"error": "not_found"}, status_code=404)
        return JSONResponse({
            "candidate_id": str(page_data.candidate_id),
            "page_title": page_data.page_title,
            "page_subtitle": page_data.page_subtitle,
            "profile_photo_url": page_data.profile_photo_url,
            "theme_overrides": page_data.theme_overrides,
            "links": page_data.links,
        })

    @router.get("/bio/{slug}/click/{link_slug}")
    def click_redirect(
        slug: str,
        link_slug: str,
        request: Request,
        q: str | None = None,
        utm_source: str | None = None,
        utm_medium: str | None = None,
        utm_campaign: str | None = None,
    ):
        # Synchronous click log (we need the target URL back to redirect)
        target_url = bio_renderer.log_click_and_redirect(
            slug=slug,
            link_slug=link_slug,
            client_ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            utm={"source": utm_source, "medium": utm_medium, "campaign": utm_campaign},
            qr_token=q,
        )
        if not target_url:
            return RedirectResponse(f"/bio/{slug}", status_code=302)
        return RedirectResponse(target_url, status_code=302)

    return router


# -- helpers -----------------------------------------------------------------

def _client_ip(request: Request) -> str:
    # E55 gateway sets X-Forwarded-For; trust only the leftmost entry (real client)
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""


def _render_404() -> str:
    return """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Page not found</title>
<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:60px;color:#333}
h1{font-size:48px;margin:0}</style></head>
<body><h1>404</h1><p>This bio page is not available.</p></body></html>"""
