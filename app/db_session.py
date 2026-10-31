"""
Session State & Telemetry Storage Layer for PolicySetu AI.
Manages:
  1. Multi-turn conversation memory by citizen WhatsApp phone number (bounded window).
  2. Supabase Postgres & Public Storage Bucket for audio notes.
  3. Automatic SQLite & local filesystem fallback if Supabase keys are blank.
  4. Structured query telemetry logs streamed live to the Judge Transparency Monitor.
"""

import json
import logging
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings

logger = logging.getLogger("policysetu.db_session")
logger.setLevel(logging.INFO)


# ==============================================================================
# SQLite Local Storage Engine (Automatic Fallback & Zero-Config Mode)
# ==============================================================================

def init_sqlite_db():
    """Initializes local SQLite schema for sessions and telemetry logs."""
    conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        phone_number TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        history TEXT NOT NULL,
        state_data TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        phone_number TEXT,
        timestamp TEXT NOT NULL,
        incoming_audio_url TEXT,
        language_code TEXT,
        native_transcript TEXT,
        english_translation TEXT,
        citizen_profile TEXT,
        land_in_hectares REAL,
        csc_center TEXT,
        weather_data TEXT,
        data_gov_data TEXT,
        rag_chunks TEXT,
        verdict TEXT,
        outbound_audio_url TEXT,
        total_latency_ms REAL,
        status TEXT
    );
    """)

    conn.commit()
    conn.close()


init_sqlite_db()


# ==============================================================================
# Supabase Cloud Client (if configured)
# ==============================================================================

_SUPABASE_AVAILABLE = None

def mark_supabase_error(error: Any):
    global _SUPABASE_AVAILABLE
    err_str = str(error)
    if "PGRST205" in err_str or "schema cache" in err_str or "404" in err_str or "Bucket not found" in err_str:
        if _SUPABASE_AVAILABLE is not False:
            logger.info("Supabase schema uninitialized. Fast-switching to built-in SQLite engine.")
            _SUPABASE_AVAILABLE = False


def get_supabase_client():
    global _SUPABASE_AVAILABLE
    if _SUPABASE_AVAILABLE is False or not settings.is_supabase_configured():
        return None
    try:
        from supabase import create_client
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        _SUPABASE_AVAILABLE = False
        return None


# ==============================================================================
# Multi-Turn Session Memory (Rolling Dialogue Window)
# ==============================================================================

async def get_session_history(phone_number: str) -> str:
    """
    Retrieves conversational context from the last 24 hours for a given phone number.
    Ensures multi-turn context (e.g. land size mentioned in turn 2 after location in turn 1).
    Bounds history to the last 6 dialogue lines to avoid cross-query state contamination.
    """
    sb = get_supabase_client()
    if sb:
        try:
            cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
            res = sb.table("chat_sessions").select("history").eq("phone_number", phone_number).gte("last_updated", cutoff).execute()
            if res.data:
                raw_hist = res.data[0].get("history", "")
                lines = [l for l in raw_hist.split("\n") if l.strip()]
                return "\n".join(lines[-6:])
        except Exception as e:
            mark_supabase_error(e)
            logger.warning(f"Supabase session lookup error: {e}")

    # Fallback: SQLite
    try:
        conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT history, last_updated FROM chat_sessions WHERE phone_number = ?", (phone_number,))
        row = cursor.fetchone()
        conn.close()
        if row:
            raw_hist = row[0]
            lines = [l for l in raw_hist.split("\n") if l.strip()]
            return "\n".join(lines[-6:])
    except Exception as e:
        logger.error(f"SQLite session lookup error: {e}")

    return ""


async def save_session_history(phone_number: str, session_id: str, new_user_msg: str, bot_reply: str):
    """Appends to conversation history."""
    existing_history = await get_session_history(phone_number)
    updated_history = (
        f"{existing_history}\nCitizen: {new_user_msg}\nOfficer: {bot_reply}".strip()
        if existing_history
        else f"Citizen: {new_user_msg}\nOfficer: {bot_reply}"
    )

    now_iso = datetime.utcnow().isoformat()

    sb = get_supabase_client()
    if sb:
        try:
            sb.table("chat_sessions").upsert({
                "phone_number": phone_number,
                "session_id": session_id,
                "history": updated_history,
                "last_updated": now_iso
            }).execute()
        except Exception as e:
            mark_supabase_error(e)
            logger.warning(f"Supabase session save error: {e}")

    # SQLite
    try:
        conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_sessions (phone_number, session_id, history, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(phone_number) DO UPDATE SET
                session_id = excluded.session_id,
                history = excluded.history,
                last_updated = excluded.last_updated
        """, (phone_number, session_id, updated_history, now_iso))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"SQLite session save error: {e}")


async def clear_session_history(phone_number: str):
    """
    Clears conversation memory for a given phone number.
    Ensures a fresh multi-turn start when the citizen or tester resets the chat.
    """
    sb = get_supabase_client()
    if sb:
        try:
            sb.table("chat_sessions").delete().eq("phone_number", phone_number).execute()
        except Exception as e:
            logger.warning(f"Supabase session clear error: {e}")

    try:
        conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chat_sessions WHERE phone_number = ?", (phone_number,))
        conn.commit()
        conn.close()
        logger.info(f"Cleared session history for {phone_number}")
    except Exception as e:
        logger.error(f"SQLite session clear error: {e}")


# ==============================================================================
# Audio Storage Upload (Supabase Public Bucket with Local Fallback)
# ==============================================================================

async def upload_audio_to_public_storage(file_path: Path) -> str:
    """
    Uploads an outbound .ogg voice note to a public Supabase Storage Bucket,
    returning a publicly accessible URL for Twilio WhatsApp playback.
    Falls back to the local FastAPI static URL if Supabase is not configured.
    """
    sb = get_supabase_client()
    if sb and file_path.exists():
        try:
            bucket_name = settings.SUPABASE_STORAGE_BUCKET
            file_name = file_path.name
            with open(file_path, "rb") as f:
                content = f.read()
            # Upload to Supabase bucket
            sb.storage.from_(bucket_name).upload(
                path=file_name,
                file=content,
                file_options={"content-type": "audio/ogg", "upsert": "true"}
            )
            # Retrieve public URL
            public_url = sb.storage.from_(bucket_name).get_public_url(file_name)
            if public_url:
                return public_url
        except Exception as e:
            mark_supabase_error(e)
            logger.warning(f"Supabase audio upload error: {e}. Falling back to public base URL.")

    # Local fallback URL served by FastAPI static route
    base_url = settings.BASE_PUBLIC_URL.rstrip('/')
    return f"{base_url}/static/audio/{file_path.name}"


# ==============================================================================
# Judge Telemetry Logger (Rule 7a/7c Proof Engine)
# ==============================================================================

async def log_telemetry_event(payload: Dict[str, Any]):
    """
    Logs an end-to-end execution record into the telemetry_logs table.
    Enables live proof display on the Judge Transparency Monitor.
    """
    record = {
        "session_id": payload.get("session_id", "sess_" + str(int(time.time()))),
        "phone_number": payload.get("phone_number", "unknown"),
        "timestamp": datetime.utcnow().isoformat(),
        "incoming_audio_url": payload.get("incoming_audio_url", ""),
        "language_code": payload.get("language_code", "mr-IN"),
        "native_transcript": payload.get("native_transcript", ""),
        "english_translation": payload.get("english_translation", ""),
        "citizen_profile": json.dumps(payload.get("citizen_profile", {}), ensure_ascii=False),
        "land_in_hectares": payload.get("land_in_hectares"),
        "csc_center": json.dumps(payload.get("csc_center", {}), ensure_ascii=False),
        "weather_data": json.dumps(payload.get("weather_data", {}), ensure_ascii=False),
        "data_gov_data": json.dumps(payload.get("data_gov_data", {}), ensure_ascii=False),
        "rag_chunks": json.dumps(payload.get("rag_chunks", []), ensure_ascii=False),
        "verdict": json.dumps(payload.get("verdict", {}), ensure_ascii=False),
        "outbound_audio_url": payload.get("outbound_audio_url", ""),
        "total_latency_ms": payload.get("total_latency_ms", 0.0),
        "status": payload.get("status", "SUCCESS")
    }

    # 1. Supabase Cloud insertion
    sb = get_supabase_client()
    if sb:
        try:
            sb.table("telemetry_logs").insert(record).execute()
        except Exception as e:
            mark_supabase_error(e)
            logger.warning(f"Supabase telemetry insert failed: {e}")

    # 2. SQLite local insertion
    try:
        conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO telemetry_logs (
                session_id, phone_number, timestamp, incoming_audio_url,
                language_code, native_transcript, english_translation,
                citizen_profile, land_in_hectares, csc_center, weather_data,
                data_gov_data, rag_chunks, verdict, outbound_audio_url,
                total_latency_ms, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record["session_id"], record["phone_number"], record["timestamp"],
            record["incoming_audio_url"], record["language_code"],
            record["native_transcript"], record["english_translation"],
            record["citizen_profile"], record["land_in_hectares"],
            record["csc_center"], record["weather_data"], record["data_gov_data"],
            record["rag_chunks"], record["verdict"], record["outbound_audio_url"],
            record["total_latency_ms"], record["status"]
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"SQLite telemetry insert failed: {e}")


def get_latest_telemetry_logs(limit: int = 15) -> List[Dict[str, Any]]:
    """Fetches latest telemetry logs for the Streamlit dashboard."""
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("telemetry_logs").select("*").order("timestamp", desc=True).limit(limit).execute()
            if res.data:
                return res.data
        except Exception as e:
            mark_supabase_error(e)
            logger.warning(f"Supabase fetch logs error: {e}")

    # Fallback SQLite query
    logs = []
    try:
        conn = sqlite3.connect(str(settings.SQLITE_DB_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM telemetry_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        for r in rows:
            d = dict(r)
            # Parse JSON fields
            for field in ["citizen_profile", "csc_center", "weather_data", "data_gov_data", "rag_chunks", "verdict"]:
                if d.get(field):
                    try:
                        d[field] = json.loads(d[field])
                    except Exception:
                        pass
            logs.append(d)
        conn.close()
    except Exception as e:
        logger.error(f"SQLite fetch logs error: {e}")

    return logs
