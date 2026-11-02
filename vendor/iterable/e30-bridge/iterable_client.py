"""Iterable REST client — E30 execution + propensity plumbing.

Canon:
  docs/canonical/seamless-research/ITERABLE_NOVA_TEARDOWN_PROPENSITY_REFERENCE_2026-06-13.md
  docs/canonical/seamless-research/ITERABLE_FULL_CAPABILITY_INVENTORY_2026-06-13.md

Rules:
  - Api-Key auth only (server-side). Never embed keys in client bundles.
  - Donor signature must not leave Hetzner — callers pass de-identified userId.
  - LP (E19) decides; Iterable executes / supplies propensities.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("e30.iterable_client")

DEFAULT_BASE_URL = "https://api.iterable.com"
DEFAULT_TIMEOUT_SEC = 30


@dataclass
class IterableResponse:
    ok: bool
    status_code: int
    body: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    raw_text: str = ""


class IterableClient:
    """Thin HTTPS client for api.iterable.com."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout_sec: float = DEFAULT_TIMEOUT_SEC,
    ):
        self.api_key = api_key or os.environ.get("ITERABLE_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.timeout_sec = timeout_sec

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> IterableResponse:
        if not self.api_key:
            return IterableResponse(
                ok=False, status_code=0, error="ITERABLE_API_KEY not set"
            )

        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urllib.parse.urlencode(query)}"

        data = None
        headers = {
            "Api-Key": self.api_key,
            "Accept": "application/json",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                raw = resp.read().decode("utf-8") or "{}"
                try:
                    body = json.loads(raw)
                except json.JSONDecodeError:
                    body = {"raw": raw}
                return IterableResponse(
                    ok=200 <= resp.status < 300,
                    status_code=resp.status,
                    body=body if isinstance(body, dict) else {"data": body},
                    raw_text=raw,
                )
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                body = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                body = {"raw": raw}
            return IterableResponse(
                ok=False,
                status_code=exc.code,
                body=body if isinstance(body, dict) else {},
                error=f"HTTP {exc.code}: {raw[:300]}",
                raw_text=raw,
            )
        except Exception as exc:
            return IterableResponse(ok=False, status_code=0, error=str(exc))

    # -- Users -------------------------------------------------------------

    def get_user_by_id(self, user_id: str) -> IterableResponse:
        return self._request("GET", f"/api/users/byUserId/{urllib.parse.quote(user_id)}")

    def update_user(self, user_id: str, data_fields: Dict[str, Any],
                    email: Optional[str] = None) -> IterableResponse:
        payload: Dict[str, Any] = {"userId": user_id, "dataFields": data_fields}
        if email:
            payload["email"] = email
        return self._request("POST", "/api/users/update", payload=payload)

    def bulk_update_users(self, users: List[Dict[str, Any]]) -> IterableResponse:
        return self._request("POST", "/api/users/bulkUpdate", payload={"users": users})

    # -- Events ------------------------------------------------------------

    def track_event(self, user_id: str, event_name: str,
                    data_fields: Optional[Dict[str, Any]] = None) -> IterableResponse:
        payload: Dict[str, Any] = {"userId": user_id, "eventName": event_name}
        if data_fields:
            payload["dataFields"] = data_fields
        return self._request("POST", "/api/events/track", payload=payload)

    # -- Email send (transactional / triggered) ----------------------------

    def send_email(
        self,
        *,
        campaign_id: int,
        recipient_email: str,
        user_id: Optional[str] = None,
        data_fields: Optional[Dict[str, Any]] = None,
    ) -> IterableResponse:
        """POST /api/email/target — triggered campaign send.

        Prefer userId (de-identified) over email when both exist.
        """
        payload: Dict[str, Any] = {
            "campaignId": campaign_id,
            "recipientEmail": recipient_email,
        }
        if user_id:
            payload["recipientUserId"] = user_id
        if data_fields:
            payload["dataFields"] = data_fields
        return self._request("POST", "/api/email/target", payload=payload)

    # -- Journeys ----------------------------------------------------------

    def trigger_workflow(self, workflow_id: int, user_id: str,
                         data_fields: Optional[Dict[str, Any]] = None) -> IterableResponse:
        payload: Dict[str, Any] = {"workflowId": workflow_id, "userId": user_id}
        if data_fields:
            payload["dataFields"] = data_fields
        return self._request("POST", "/api/workflows/triggerWorkflow", payload=payload)

    # -- Export (propensity / engagement batch) ----------------------------

    def export_data(
        self,
        data_type_name: str,
        *,
        start_date_time: Optional[str] = None,
        end_date_time: Optional[str] = None,
        only_fields: Optional[str] = None,
    ) -> IterableResponse:
        query: Dict[str, Any] = {"dataTypeName": data_type_name}
        if start_date_time:
            query["startDateTime"] = start_date_time
        if end_date_time:
            query["endDateTime"] = end_date_time
        if only_fields:
            query["onlyFields"] = only_fields
        return self._request("GET", "/api/export/data.json", query=query)
