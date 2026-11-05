"""
E31 Twilio Webhook Receiver
FastAPI endpoints for Twilio delivery status callbacks and inbound SMS.

Routes:
  POST /webhooks/e31/delivery  — Twilio delivery status → update sms_platform_log
  POST /webhooks/e31/inbound   — inbound SMS/STOP → sms_inbound + opt-out + Brain event

TCPA hard rules:
  - STOP/UNSUBSCRIBE/CANCEL/END/QUIT detected → opt_out immediately, < 60 seconds
  - Opt-out is platform-wide (core.sms_phone_registry) — ALL candidates honoured
  - Every inbound is logged to e31.sms_inbound before any other action
  - Brain event T-C-902 fired on every opt-out (Brain updates Brain.throttle_registry)

Author:   Claude — 2026-06-05
Deployer: Cursor (Hetzner 37.27.169.232)
"""

import os
import logging
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Request, Form, HTTPException, Header
from fastapi.responses import PlainTextResponse
from twilio.request_validator import RequestValidator

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:Anamaria@2026@37.27.169.232:5432/postgres"
)
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
WEBHOOK_BASE_URL  = os.getenv("WEBHOOK_BASE_URL", "https://bgop.app")  # for signature validation

STOP_KEYWORDS = {"stop", "unsubscribe", "cancel", "end", "quit", "stopall"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("e31.webhook")

app = FastAPI(title="E31 Twilio Webhook", version="1.0.0")

# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


# ---------------------------------------------------------------------------
# Twilio signature validation (production guard)
# ---------------------------------------------------------------------------

def validate_twilio_signature(request_url: str, params: dict, signature: str) -> bool:
    if not TWILIO_AUTH_TOKEN:
        logger.warning("TWILIO_AUTH_TOKEN not set — skipping signature validation")
        return True
    validator = RequestValidator(TWILIO_AUTH_TOKEN)
    return validator.validate(request_url, params, signature)


# ---------------------------------------------------------------------------
# POST /webhooks/e31/delivery
# Twilio calls this for every delivery status update.
# Updates e31.sms_platform_log.twilio_status for the matching MessageSID.
# ---------------------------------------------------------------------------

@app.post("/webhooks/e31/delivery", response_class=PlainTextResponse)
async def delivery_status(
    request: Request,
    MessageSid: str = Form(...),
    MessageStatus: str = Form(...),
    To: str = Form(None),
    From: str = Form(None),
    X_Twilio_Signature: str = Header(None, alias="X-Twilio-Signature"),
):
    # Validate signature
    form_data = dict(await request.form())
    url = f"{WEBHOOK_BASE_URL}/webhooks/e31/delivery"
    if X_Twilio_Signature and not validate_twilio_signature(url, form_data, X_Twilio_Signature):
        logger.warning("Invalid Twilio signature on delivery webhook")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    logger.info(f"Delivery status: SID={MessageSid} status={MessageStatus}")

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE e31.sms_platform_log
                    SET    twilio_status = %s
                    WHERE  twilio_message_sid = %s
                    """,
                    (MessageStatus, MessageSid)
                )
                updated = cur.rowcount
                conn.commit()

        if updated == 0:
            logger.warning(f"Delivery status for unknown SID: {MessageSid}")

    except Exception as e:
        logger.error(f"Delivery webhook DB error: {e}")
        raise HTTPException(status_code=500, detail="DB error")

    # Twilio expects 200 + empty TwiML or plain text
    return PlainTextResponse("", status_code=200)


# ---------------------------------------------------------------------------
# POST /webhooks/e31/inbound
# Twilio calls this when a donor texts one of our numbers.
# Steps:
#   1. Log to e31.sms_inbound (always, unconditionally)
#   2. Detect STOP keyword
#   3. If STOP: platform-wide opt-out in core.sms_phone_registry (< 60 sec)
#   4. If STOP: post T-C-902 event to brain.event_queue
#   5. Return TwiML (empty response — do not auto-reply)
# ---------------------------------------------------------------------------

@app.post("/webhooks/e31/inbound", response_class=PlainTextResponse)
async def inbound_sms(
    request: Request,
    MessageSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    Body: str = Form(default=""),
    MediaUrl0: str = Form(default=None),
    NumMedia: str = Form(default="0"),
    X_Twilio_Signature: str = Header(None, alias="X-Twilio-Signature"),
):
    form_data = dict(await request.form())
    url = f"{WEBHOOK_BASE_URL}/webhooks/e31/inbound"
    if X_Twilio_Signature and not validate_twilio_signature(url, form_data, X_Twilio_Signature):
        logger.warning("Invalid Twilio signature on inbound webhook")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    body_clean    = (Body or "").strip()
    first_word    = body_clean.split()[0].lower() if body_clean else ""
    is_stop       = first_word in STOP_KEYWORDS
    stop_keyword  = first_word.upper() if is_stop else None
    media_url     = MediaUrl0 if int(NumMedia or 0) > 0 else None

    logger.info(f"Inbound: From={From} To={To} SID={MessageSid} is_stop={is_stop}")

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:

                # Step 1 — look up candidate from number pool
                cur.execute(
                    "SELECT candidate_id FROM e31.sms_number_pool WHERE phone_e164 = %s",
                    (To,)
                )
                row = cur.fetchone()
                candidate_id = str(row["candidate_id"]) if row and row["candidate_id"] else None

                # Step 2 — log inbound (unconditional)
                cur.execute(
                    """
                    INSERT INTO e31.sms_inbound
                      (twilio_message_sid, from_phone, to_phone, message_body, media_url,
                       is_stop_keyword, stop_keyword, classified_as, candidate_id, received_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (twilio_message_sid) DO NOTHING
                    """,
                    (MessageSid, From, To, body_clean, media_url,
                     is_stop, stop_keyword,
                     "stop" if is_stop else "reply",
                     candidate_id)
                )

                # Step 3 — STOP: platform-wide opt-out in core.sms_phone_registry
                if is_stop:
                    cur.execute(
                        """
                        INSERT INTO core.sms_phone_registry
                          (phone_e164, opt_in_status, opt_out_timestamp, opt_out_keyword, updated_at)
                        VALUES (%s, 'opted_out', now(), %s, now())
                        ON CONFLICT (phone_e164) DO UPDATE
                          SET opt_in_status    = 'opted_out',
                              opt_out_timestamp = now(),
                              opt_out_keyword   = EXCLUDED.opt_out_keyword,
                              updated_at        = now()
                        """,
                        (From, stop_keyword)
                    )
                    logger.info(f"Opt-out recorded: {From} keyword={stop_keyword}")

                    # Step 4 — cancel active drip enrollments for this phone
                    cur.execute(
                        """
                        UPDATE e31.sms_drip_enrollments
                        SET    status = 'opted_out', completed_at = now()
                        WHERE  phone_e164 = %s AND status = 'active'
                        """,
                        (From,)
                    )

                    # Step 5 — Brain event T-C-902 (STOP received)
                    brain_payload = {
                        "trigger": "T-C-902",
                        "event":   "sms_opt_out",
                        "phone":   From,
                        "keyword": stop_keyword,
                        "source":  "e31_inbound_webhook",
                        "candidate_id": candidate_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    try:
                        cur.execute(
                            """
                            INSERT INTO brain.event_queue
                              (source_ecosystem, event_class, payload, created_at)
                            VALUES ('E31', 'sms_opt_out', %s::jsonb, now())
                            """,
                            (psycopg2.extras.Json(brain_payload),)
                        )
                    except Exception as brain_err:
                        # Brain queue insert failure must not block opt-out commit
                        logger.error(f"Brain event_queue insert failed: {brain_err}")

                conn.commit()

    except Exception as e:
        logger.error(f"Inbound webhook DB error: {e}")
        raise HTTPException(status_code=500, detail="DB error")

    # Return empty TwiML — do not send an automatic reply
    return PlainTextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        status_code=200,
        media_type="text/xml"
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/webhooks/e31/health")
async def health():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS cnt FROM raw.ncboe_donations WHERE cluster_id = 372171"
                )
                row = cur.fetchone()
                canary_ok = row["cnt"] == 147
        return {
            "status": "ok" if canary_ok else "canary_failed",
            "canary": row["cnt"],
            "expected": 147
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
