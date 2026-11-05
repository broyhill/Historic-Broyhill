"""
ecosystems/E19_social/bio/geo_ip.py

Best-effort geo IP resolution for bio click analytics.

Resolves (country, region, city) from an IP address. Used only for analytics
display — never for targeting, never for blocking, never written to PII tables.

Two modes supported:
    1. local — MaxMind GeoLite2 .mmdb file mounted on disk (preferred for prod)
    2. http  — call out to ipapi/ipstack/etc. (fallback for dev environments)

Either mode is non-blocking on failure: returns None and the click row keeps
ip_hash but no geo data. Never raises.
"""

# SEARCH-INDEX: ecosystem=E19_social tier=service
# SEARCH-KEYWORDS: e19_social geo-ip maxmind ipapi analytics


from __future__ import annotations

import ipaddress
import logging
import os
import threading
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class GeoResult:
    country: str | None = None
    region: str | None = None
    city: str | None = None


class GeoIPResolver:
    """
    Singleton-style resolver. Reads MAXMIND_DB_PATH env var; falls back to
    HTTP if that's not present. Caches the reader across calls.
    """
    _instance: "GeoIPResolver | None" = None
    _lock = threading.Lock()

    @classmethod
    def get(cls) -> "GeoIPResolver":
        with cls._lock:
            if cls._instance is None:
                cls._instance = GeoIPResolver()
            return cls._instance

    def __init__(self):
        self._reader = None
        self._mode = "none"
        mmdb_path = os.environ.get("MAXMIND_DB_PATH")
        if mmdb_path and os.path.exists(mmdb_path):
            try:
                import geoip2.database  # type: ignore
                self._reader = geoip2.database.Reader(mmdb_path)
                self._mode = "local"
                logger.info("geo IP resolver: local MaxMind at %s", mmdb_path)
            except Exception:
                logger.exception("failed to open MaxMind DB at %s", mmdb_path)
        if self._mode == "none":
            self._mode = "http"
            logger.info("geo IP resolver: HTTP fallback mode (rate-limited; configure MaxMind for production)")

    def resolve(self, ip: str) -> GeoResult:
        if not ip or not self._is_public_ip(ip):
            return GeoResult()

        if self._mode == "local":
            return self._resolve_local(ip)
        elif self._mode == "http":
            return self._resolve_http(ip)
        return GeoResult()

    def _resolve_local(self, ip: str) -> GeoResult:
        try:
            r = self._reader.city(ip)
            return GeoResult(
                country=r.country.iso_code,
                region=r.subdivisions.most_specific.iso_code if r.subdivisions else None,
                city=r.city.name,
            )
        except Exception:
            logger.debug("geo lookup failed for %s", ip)
            return GeoResult()

    def _resolve_http(self, ip: str) -> GeoResult:
        # Conservative HTTP fallback: ip-api.com (free tier, 45 req/min)
        # Production should use MaxMind. This is the dev-environment path.
        try:
            import requests  # type: ignore
            resp = requests.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,countryCode,region,regionName,city"},
                timeout=2.0,
            )
            data = resp.json()
            if data.get("status") == "success":
                return GeoResult(
                    country=data.get("countryCode"),
                    region=data.get("region"),
                    city=data.get("city"),
                )
        except Exception:
            pass
        return GeoResult()

    @staticmethod
    def _is_public_ip(ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(ip)
            return addr.is_global
        except ValueError:
            return False
