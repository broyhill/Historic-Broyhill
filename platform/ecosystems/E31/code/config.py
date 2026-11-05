"""
E31 Configuration — environment, costs, provider credentials, compliance limits.
"""

import os


class E31Config:
    """Central config for the E31 SMS/MMS platform."""

    # ── Database ──────────────────────────────────────────────────────
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:Anamaria@2026@37.27.169.232:5432/postgres",
    )

    # ── Twilio ────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_DEFAULT_FROM: str = os.getenv("TWILIO_DEFAULT_FROM", "")
    # DARK SEND (W02 product ruling 2026-10-03: Twilio). With TWILIO_TEST_MODE=true the provider uses Twilio's TEST credentials
    # (TWILIO_TEST_ACCOUNT_SID / TWILIO_TEST_AUTH_TOKEN) and the magic From +15005550006: full API round-trip, no carrier delivery, no charge.
    TWILIO_TEST_MODE: bool = os.getenv("TWILIO_TEST_MODE", "true").lower() == "true"
    TWILIO_TEST_ACCOUNT_SID: str = os.getenv("TWILIO_TEST_ACCOUNT_SID", "")
    TWILIO_TEST_AUTH_TOKEN: str = os.getenv("TWILIO_TEST_AUTH_TOKEN", "")
    TWILIO_MAGIC_FROM: str = "+15005550006"
    TWILIO_MESSAGING_SERVICE_SID: str = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")   # set once the 10DLC campaign is approved
    TWILIO_STATUS_CALLBACK_URL: str = os.getenv(
        "TWILIO_STATUS_CALLBACK_URL", ""
    )

    # ── Sinch ─────────────────────────────────────────────────────────
    SINCH_APP_ID: str = os.getenv("SINCH_APP_ID", "")
    SINCH_APP_SECRET: str = os.getenv("SINCH_APP_SECRET", "")
    SINCH_SERVICE_PLAN_ID: str = os.getenv("SINCH_SERVICE_PLAN_ID", "")

    # ── Bandwidth ─────────────────────────────────────────────────────
    BANDWIDTH_ACCOUNT_ID: str = os.getenv("BANDWIDTH_ACCOUNT_ID", "")
    BANDWIDTH_API_TOKEN: str = os.getenv("BANDWIDTH_API_TOKEN", "")
    BANDWIDTH_APPLICATION_ID: str = os.getenv("BANDWIDTH_APPLICATION_ID", "")

    # ── Sendblue (iMessage) ───────────────────────────────────────────
    SENDBLUE_API_KEY: str = os.getenv("SENDBLUE_API_KEY", "")
    SENDBLUE_API_SECRET: str = os.getenv("SENDBLUE_API_SECRET", "")
    SENDBLUE_WEBHOOK_URL: str = os.getenv("SENDBLUE_WEBHOOK_URL", "")

    # ── Shortlinks ────────────────────────────────────────────────────
    SHORTLINK_DOMAIN: str = os.getenv("SHORTLINK_DOMAIN", "https://bgop.link")

    # ── Costs (USD per unit — Twilio baseline) ────────────────────────
    COST_PER_SMS_SEGMENT: float = 0.0079
    COST_PER_MMS: float = 0.02
    COST_PER_RCS: float = 0.015
    COST_PER_IMESSAGE: float = 0.0  # flat per-line, no per-message cost

    # ── SMS constraints ───────────────────────────────────────────────
    MAX_SMS_LENGTH: int = 160
    MAX_SEGMENTS: int = 10  # Twilio max concatenated SMS segments
    MMS_MAX_MEDIA_SIZE_MB: int = 5

    # ── Compliance ────────────────────────────────────────────────────
    QUIET_HOURS_START: int = 21  # 9 PM local time — no texting after this
    QUIET_HOURS_END: int = 8    # 8 AM local time — no texting before this
    TEXTS_PER_DAY_LIMIT: int = 1  # TCPA one-text-per-day per phone
    RATE_LIMIT_PER_SECOND: int = 50  # Provider rate limit

    # ── Provider priority (failover order) ────────────────────────────
    PROVIDER_PRIORITY: list = ["sendblue", "twilio", "sinch", "bandwidth"]

    # ── STOP keywords (CTIA + TCPA) ──────────────────────────────────
    STOP_KEYWORDS: list = [
        "stop", "unsubscribe", "cancel", "end", "quit",
        "stopall", "stop all",
    ]
    HELP_KEYWORDS: list = ["help", "info"]

    # ── AI Composer ───────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 300

    # ── Brain integration ─────────────────────────────────────────────
    BRAIN_THROTTLE_DAILY_LIMIT: int = 10_000_000
    BRAIN_THROTTLE_PER_CANDIDATE: int = 50_000

    @classmethod
    def is_twilio_configured(cls) -> bool:
        return bool(cls.TWILIO_ACCOUNT_SID and cls.TWILIO_AUTH_TOKEN)

    @classmethod
    def is_sinch_configured(cls) -> bool:
        return bool(cls.SINCH_APP_ID and cls.SINCH_APP_SECRET)

    @classmethod
    def is_bandwidth_configured(cls) -> bool:
        return bool(cls.BANDWIDTH_ACCOUNT_ID and cls.BANDWIDTH_API_TOKEN)

    @classmethod
    def is_sendblue_configured(cls) -> bool:
        return bool(cls.SENDBLUE_API_KEY and cls.SENDBLUE_API_SECRET)
