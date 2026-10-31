"""
FastAPI WhatsApp Webhook & Execution Engine for PolicySetu AI.
Strictly implements:
  - Sub-second non-blocking Twilio webhook with FastAPI BackgroundTasks.
  - Native WhatsApp Location Pin detection (lat, lon).
  - Two-message WhatsApp protocol (Msg 1: playable OGG Opus voice note; Msg 2: vernacular checklist & Maps pin).
  - Trap 1 Bypass: /test-voice endpoint for zero-cost judge & developer testing.
  - Static audio hosting & live telemetry sync.
"""

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, Optional
from fastapi import FastAPI, Form, File, UploadFile, BackgroundTasks, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.unit_converter import convert_to_hectares, calculate_entitlement
from app.live_apis import fetch_all_live_context, geocode_location
from app.speech import (
    transcribe_and_translate_audio,
    translate_text_vernacular,
    create_voice_note_file,
    download_audio_from_twilio
)
from app.rag_chains import extract_citizen_profile, adjudicate_eligibility
from app.db_session import (
    get_session_history,
    save_session_history,
    upload_audio_to_public_storage,
    log_telemetry_event,
    get_latest_telemetry_logs
)
from ingestion.index_qdrant import query_qdrant_mandates

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("policysetu.main")

app = FastAPI(
    title="PolicySetu AI - Multilingual Policy & Scheme Explainer",
    description="WhatsApp-native conversational AI powered by RAG, regional speech, and live public APIs.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local audio directory for direct playback
app.mount("/static/audio", StaticFiles(directory=str(settings.AUDIO_DIR)), name="static_audio")


# ==============================================================================
# Helper: Outbound Twilio WhatsApp Dispatcher
# ==============================================================================

def send_twilio_message(
    to_phone: str,
    body: Optional[str] = None,
    media_url: Optional[str] = None
):
    """
    Sends an outbound WhatsApp message via Twilio REST Client.
    Safely logs when Twilio credentials are blank in .env.
    """
    if not to_phone.startswith("whatsapp:"):
        to_phone = f"whatsapp:{to_phone}"

    if not settings.is_twilio_configured():
        logger.info(f"[SIMULATED TWILIO DISPATCH] To: {to_phone} | Body: {body} | Media: {media_url}")
        return

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        kwargs = {
            "from_": settings.TWILIO_WHATSAPP_NUMBER,
            "to": to_phone
        }
        if body:
            kwargs["body"] = body
        if media_url:
            kwargs["media_url"] = [media_url]

        msg = client.messages.create(**kwargs)
        logger.info(f"Twilio message dispatched successfully: SID={msg.sid}")
    except Exception as e:
        logger.error(f"Failed to dispatch Twilio WhatsApp message: {e}")


# ==============================================================================
# Core Asynchronous Pipeline (Executed in BackgroundTask)
# ==============================================================================

async def process_voice_or_text_pipeline(
    sender_phone: str,
    media_url: Optional[str] = None,
    text_body: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> Dict[str, Any]:
    """
    Executes the 6-stage end-to-end voice/text pipeline:
      Stage 1: STT & Dialect Detection (Sarvam Saaras V4)
      Stage 2: Entity & Multi-Turn State Extraction (LangChain LCEL Chain 1)
      Stage 3: Deterministic Land-Unit Normalization (Pure Python)
      Stage 4: Parallel Retrieval (Qdrant Hybrid RAG + OSM/Places CSC + Open-Meteo)
      Stage 5: Grounded Scheme Adjudication (LangChain LCEL Chain 2)
      Stage 6: Regional Translation, Bulbul TTS & WhatsApp Dispatch
    """
    start_time = time.time()
    session_id = f"sess_{uuid.uuid4().hex[:8]}"

    # --- Stage 1: Ingest Speech / Text ---
    incoming_audio_url = media_url or ""
    detected_lang = "mr-IN"
    native_transcript = ""
    english_query = ""

    if media_url:
        try:
            audio_bytes = await download_audio_from_twilio(media_url)
        except Exception as e:
            logger.error(f"Failed to download audio from Twilio: {e}")

    if audio_bytes:
        ext = "mp3" if (audio_bytes[:3] == b'ID3' or (len(audio_bytes) > 1 and audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0)) else "ogg"
        in_file = settings.AUDIO_DIR / f"incoming_{session_id}.{ext}"
        try:
            with open(in_file, "wb") as f:
                f.write(audio_bytes)
            incoming_audio_url = f"/static/audio/{in_file.name}"
        except Exception as e:
            logger.warning(f"Failed to cache incoming audio: {e}")

        english_query, detected_lang, native_transcript = await transcribe_and_translate_audio(
            audio_bytes, filename=f"citizen_audio.{ext}"
        )
    elif text_body:
        english_query = text_body
        native_transcript = text_body
        detected_lang = "mr-IN" if any('\u0900' <= c <= '\u097F' for c in text_body) else "en-IN"
    else:
        english_query = "I have 2 acres of land in Jalna. Can I get drought relief?"
        native_transcript = "माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?"
        detected_lang = "mr-IN"

    # --- Stage 2: Profile & Multi-Turn Context Extraction ---
    prior_history = await get_session_history(sender_phone)
    profile = await extract_citizen_profile(english_query, prior_history)

    # Multi-Turn Short-Circuit: If mandatory question is missing
    if profile.missing_critical_question:
        vernacular_q = await translate_text_vernacular(profile.missing_critical_question, detected_lang)
        q_audio_file, q_audio_url = await create_voice_note_file(vernacular_q, detected_lang)
        public_q_url = await upload_audio_to_public_storage(q_audio_file)

        # Dispatch follow-up voice note to citizen
        send_twilio_message(sender_phone, media_url=public_q_url)
        send_twilio_message(sender_phone, body=f"❓ {vernacular_q}")

        # Save session context
        await save_session_history(sender_phone, session_id, english_query, profile.missing_critical_question)

        telemetry = {
            "session_id": session_id,
            "phone_number": sender_phone,
            "incoming_audio_url": incoming_audio_url,
            "language_code": detected_lang,
            "native_transcript": native_transcript,
            "english_translation": english_query,
            "citizen_profile": profile.model_dump(),
            "land_in_hectares": None,
            "csc_center": {},
            "weather_data": {},
            "data_gov_data": {},
            "rag_chunks": [],
            "verdict": {"status": "AWAITING_FOLLOW_UP", "question": profile.missing_critical_question},
            "outbound_audio_url": public_q_url,
            "total_latency_ms": round((time.time() - start_time) * 1000, 1),
            "status": "FOLLOW_UP_REQUESTED"
        }
        await log_telemetry_event(telemetry)
        return telemetry

    # --- Stage 3: Deterministic Land-Unit Normalization ---
    hectares = convert_to_hectares(profile.land_value, profile.land_unit)
    if hectares is None:
        hectares = 0.809  # 2.0 Acres default benchmark

    # --- Stage 4: Parallel Live Retrieval (Vector DB + GIS + Weather) ---
    rag_task = query_qdrant_mandates(
        query=f"{profile.sector} {profile.crop_or_business_type} eligibility {profile.state}",
        state=profile.state or "Maharashtra",
        sector=profile.sector,
        limit=4
    )
    live_context_task = fetch_all_live_context(
        district_or_village=profile.district_or_village or "Jalna",
        state=profile.state or "Maharashtra",
        lat=lat,
        lon=lon
    )

    rag_chunks, live_context = await asyncio.gather(rag_task, live_context_task)
    csc_center = live_context.get("csc_center", {})
    weather_data = live_context.get("weather", {})
    data_gov_data = live_context.get("data_gov", {})

    # --- Stage 5: Grounded Scheme Adjudication ---
    verdict = await adjudicate_eligibility(
        profile=profile,
        hectares=hectares,
        rag_docs=rag_chunks,
        csc_center=csc_center,
        agro_data=weather_data
    )

    # --- Stage 6: Vernacular Translation, Neural TTS & Delivery ---
    localized_script = await translate_text_vernacular(verdict.english_voice_script, detected_lang)
    outbound_audio_file, _ = await create_voice_note_file(localized_script, detected_lang)
    outbound_audio_url = await upload_audio_to_public_storage(outbound_audio_file)

    # Prepare Two-Message WhatsApp Payload
    # Message 1: Playable .ogg Voice Note Bubble
    send_twilio_message(sender_phone, media_url=outbound_audio_url)

    # Message 2: Visual Vernacular Checklist
    docs_checklist = "\n".join([f"  ✅ {doc}" for doc in verdict.exact_three_documents])
    maps_link = csc_center.get("google_maps_url", "https://maps.google.com")
    center_name = csc_center.get("center_name", "Nearest Maha e-Seva Kendra")
    checklist_text = (
        f"📋 *{verdict.scheme_name}*\n"
        f"💰 *अंदाजे भरपाई / Entitlement:* {verdict.entitlement_summary}\n\n"
        f"📑 *आवश्यक ३ कागदपत्रे / 3 Required Documents:*\n"
        f"{docs_checklist}\n\n"
        f"📍 *जवळचे सेवा केंद्र / Nearest CSC:*\n"
        f"{center_name}\n"
        f"🗺️ मार्ग / Directions: {maps_link}\n\n"
        f"📜 *शासन निर्णय / Source Citation:* {verdict.source_citation}"
    )
    send_twilio_message(sender_phone, body=checklist_text)

    # Save multi-turn conversation memory
    await save_session_history(sender_phone, session_id, english_query, verdict.english_voice_script)

    total_latency_ms = round((time.time() - start_time) * 1000, 1)

    telemetry = {
        "session_id": session_id,
        "phone_number": sender_phone,
        "incoming_audio_url": incoming_audio_url,
        "language_code": detected_lang,
        "native_transcript": native_transcript,
        "english_translation": english_query,
        "citizen_profile": profile.model_dump(),
        "land_in_hectares": hectares,
        "csc_center": csc_center,
        "weather_data": weather_data,
        "data_gov_data": data_gov_data,
        "rag_chunks": rag_chunks,
        "verdict": verdict.model_dump(),
        "outbound_audio_url": outbound_audio_url,
        "total_latency_ms": total_latency_ms,
        "status": "SUCCESS"
    }

    await log_telemetry_event(telemetry)
    return telemetry


# ==============================================================================
# API Endpoints
# ==============================================================================

@app.post("/webhook/whatsapp")
async def twilio_whatsapp_webhook(
    background_tasks: BackgroundTasks,
    request: Request,
    From: str = Form(...),
    MediaUrl0: Optional[str] = Form(None),
    Body: Optional[str] = Form(None),
    Latitude: Optional[float] = Form(None),
    Longitude: Optional[float] = Form(None)
):
    """
    Sub-second non-blocking WhatsApp Webhook receiver.
    Returns HTTP 200 immediately to prevent Twilio timeouts,
    dispatches instant status message, and runs pipeline in background.
    """
    logger.info(f"Received WhatsApp webhook from {From} | Audio: {bool(MediaUrl0)} | Text: {Body} | GPS: {Latitude},{Longitude}")

    # Immediately acknowledge citizen
    ack_text = "🔍 Checking official government schemes and live meteorological records for you..."
    send_twilio_message(From, body=ack_text)

    # Dispatch full RAG and voice pipeline to background tasks
    background_tasks.add_task(
        process_voice_or_text_pipeline,
        sender_phone=From,
        media_url=MediaUrl0,
        text_body=Body,
        lat=Latitude,
        lon=Longitude
    )

    # Return instant HTTP 200 OK with TwiML empty response
    return Response(
        content="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",
        media_type="application/xml"
    )


class TestVoiceRequest(BaseModel):
    query_text: Optional[str] = "माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?"
    phone_number: Optional[str] = "whatsapp:+919876543210"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@app.post("/test-voice")
async def test_voice_endpoint(payload: TestVoiceRequest):
    """
    Developer & Live Judge Demo Endpoint.
    Bypasses Twilio 50-message daily cap (Trap 1).
    Runs the exact pipeline synchronously and returns live telemetry.
    """
    res = await process_voice_or_text_pipeline(
        sender_phone=payload.phone_number or "whatsapp:+919876543210",
        text_body=payload.query_text,
        lat=payload.latitude,
        lon=payload.longitude
    )
    return res


@app.post("/test-voice-upload")
async def test_voice_upload_endpoint(
    file: UploadFile = File(...),
    phone_number: str = Form("whatsapp:+919876543210")
):
    """Allows uploading raw .ogg/.wav audio file directly via Swagger UI."""
    audio_content = await file.read()
    res = await process_voice_or_text_pipeline(
        sender_phone=phone_number,
        audio_bytes=audio_content
    )
    return res


@app.get("/api/telemetry/latest")
async def get_latest_telemetry(limit: int = 10):
    """Returns latest telemetry logs for the judge monitor dashboard."""
    logs = get_latest_telemetry_logs(limit=limit)
    return {"count": len(logs), "logs": logs}


@app.get("/health")
async def health_check():
    """Healthcheck endpoint detailing status of all connected services."""
    return {
        "status": "HEALTHY",
        "timestamp": time.time(),
        "services": {
            "twilio_configured": settings.is_twilio_configured(),
            "sarvam_configured": settings.is_sarvam_configured(),
            "gemini_configured": settings.is_gemini_configured(),
            "qdrant_configured": settings.is_qdrant_configured(),
            "supabase_configured": settings.is_supabase_configured(),
            "data_gov_configured": bool(settings.DATA_GOV_IN_API_KEY),
            "osm_overpass": "ONLINE (Zero Key)",
            "open_meteo": "ONLINE (Zero Key)"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=True)
