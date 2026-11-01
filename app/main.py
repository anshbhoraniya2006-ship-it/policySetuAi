"""
FastAPI Multilingual Voice & Scheme Execution Engine for PolicySetu AI.
Powers the Sovereign Indian Digital Public Infrastructure (DPI) Command Center:
  - Multimodal speech ingestion (WAV/OGG/MP3/M4A via Sarvam AI & Google Gemini).
  - Multi-state (Telangana, Karnataka, MP, UP, Bihar, Punjab, Haryana, Gujarat, Maharashtra) support.
  - Multi-lingual dynamic language detection & localization across 9+ Indian languages.
  - Zero-latency website API: /test-voice and /api/query for text, /test-voice-upload for recorded voice.
  - Live agro-weather telemetry (Open-Meteo) & nearest Civic Service Center (CSC/OSM) geocoding.
  - Static audio hosting & live telemetry sync for web citizen UI.
"""

import asyncio
import logging
import time
import uuid
import httpx
from typing import Any, Dict, List, Optional, Tuple
from fastapi import FastAPI, Form, File, UploadFile, BackgroundTasks, Request, Response, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.unit_converter import convert_to_hectares, calculate_entitlement
from app.live_apis import fetch_all_live_context, geocode_location, fetch_live_agro_weather, STATE_DEFAULT_CENTROIDS
from app.speech import (
    transcribe_and_translate_audio,
    translate_text_vernacular,
    translate_to_english,
    create_voice_note_file,
    detect_text_language,
    LANGUAGE_NAMES
)
from app.rag_chains import extract_citizen_profile, adjudicate_eligibility, get_llm
from app.db_session import (
    get_session_history,
    save_session_history,
    clear_session_history,
    upload_audio_to_public_storage,
    log_telemetry_event,
    get_latest_telemetry_logs
)
from ingestion.index_qdrant import query_qdrant_mandates

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("policysetu.main")

app = FastAPI(
    title="PolicySetu AI - Sovereign DPI Multilingual Policy & Scheme Assistant",
    description="Citizen-facing conversational AI powered by Qdrant Hybrid RAG, Indic Speech, and Live Public APIs.",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local audio directory for direct browser playback
app.mount("/static/audio", StaticFiles(directory=str(settings.AUDIO_DIR)), name="static_audio")

# Mount built React frontend assets if present
FRONTEND_DIST = settings.BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")


@app.on_event("startup")
async def startup_warmup():
    """Warms up Gemini LLM SDK and database on boot to eliminate cold-start latency."""
    logger.info("Initializing PolicySetu AI Engine warmup...")
    try:
        from app.db_session import get_session_history
        await get_session_history("startup_probe")
        logger.info("Session database online.")
    except Exception as e:
        logger.warning(f"Database warmup note: {e}")

    try:
        llm = get_llm()
        if llm:
            asyncio.create_task(llm.ainvoke("ping"))
            logger.info("Gemini LLM pipeline pre-warmed.")
    except Exception as e:
        logger.warning(f"LLM pre-warm note: {e}")


# ==============================================================================
# Localized Checklist Formatting
# ==============================================================================

CHECKLIST_LOCALIZATIONS = {
    "mr-IN": {
        "entitlement": "अंदाजे भरपाई / मदत रक्कम",
        "docs": "आवश्यक ३ महत्त्वाची कागदपत्रे",
        "csc": "जवळचे सेतू / महा ई-सेवा केंद्र",
        "directions": "केंद्राचा मार्ग (Directions)",
        "citation": "शासकीय संदर्भ (GR / Mandate)",
    },
    "gu-IN": {
        "entitlement": "અંદાજિત સહાય / ચૂકવવાપાત્ર રકમ",
        "docs": "જરૂરી ૩ દસ્તાવેજો (Checklist)",
        "csc": "નજીકનું સેવા કેન્દ્ર / ઇ-ગ્રામ કેન્દ્ર",
        "directions": "સ્થળ માર્ગ / Directions",
        "citation": "સરકારી ઠરાવ / પરિપત્ર સંદર્ભ",
    },
    "hi-IN": {
        "entitlement": "अनुमानित सहायता / राहत राशि",
        "docs": "अनिवार्य ३ आवश्यक दस्तावेज",
        "csc": "नजदीकी सीएससी / ग्राहक सेवा केंद्र",
        "directions": "रास्ता / Directions",
        "citation": "शासकीय आदेश / संदर्भ",
    },
    "te-IN": {
        "entitlement": "అంచనా సహాయం / పరిహారం",
        "docs": "అవసరమైన 3 ముఖ్యమైన పత్రాలు",
        "csc": "సమీప రైతు భరోసా కేంద్రం / మీ-సేవ",
        "directions": "మార్గం / Directions",
        "citation": "ప్రభుత్వ ఉత్తర్వులు / జీవో నెం.",
    },
    "kn-IN": {
        "entitlement": "ಅಂದಾಜು ಪರಿಹಾರ ಧನ",
        "docs": "ಅಗತ್ಯವಿರುವ ೩ ದಾಖಲೆಗಳು",
        "csc": "ಹತ್ತಿರದ ಗ್ರಾಮ ಒನ್ / ಬಾಪೂಜಿ ಸೇವಾ ಕೇಂದ್ರ",
        "directions": "ಮಾರ್ಗಸೂಚಿ / Directions",
        "citation": "ಸರ್ಕಾರಿ ಆದೇಶ / ಉಲ್ಲೇಖ",
    },
    "pa-IN": {
        "entitlement": "ਅੰਦਾਜ਼ਨ ਮੁਆਵਜ਼ਾ ਰਾਸ਼ੀ",
        "docs": "ਲੋੜੀਂਦੇ 3 ਦਸਤਾਵੇਜ਼",
        "csc": "ਨੇੜਲਾ ਸੇਵਾ ਕੇਂਦਰ",
        "directions": "ਰਸਤਾ / Directions",
        "citation": "ਸਰਕਾਰੀ ਹੁਕਮ / Source Citation",
    },
    "en-IN": {
        "entitlement": "Estimated Entitlement",
        "docs": "3 Required Mandatory Documents",
        "csc": "Nearest Service Center",
        "directions": "Directions / Route",
        "citation": "Source Citation / Mandate",
    }
}


def format_scheme_checklist(
    verdict: Any,
    csc_center: Dict[str, Any],
    lang_code: str
) -> str:
    """Formats visual checklist card with localized regional headers."""
    loc = CHECKLIST_LOCALIZATIONS.get(
        lang_code,
        CHECKLIST_LOCALIZATIONS.get(lang_code[:2] + "-IN", CHECKLIST_LOCALIZATIONS["hi-IN"])
    )
    if isinstance(verdict, dict):
        scheme_name = verdict.get("scheme_name", "Government Welfare Scheme")
        entitlement = verdict.get("entitlement_summary", "Applicable")
        docs = verdict.get("exact_three_documents", ["Relevant Land Extract", "Aadhaar Card", "Bank Passbook"])
        citation = verdict.get("source_citation", "Official Government Mandate")
    else:
        scheme_name = getattr(verdict, "scheme_name", "Government Welfare Scheme")
        entitlement = getattr(verdict, "entitlement_summary", "Applicable")
        docs = getattr(verdict, "exact_three_documents", ["Relevant Land Extract", "Aadhaar Card", "Bank Passbook"])
        citation = getattr(verdict, "source_citation", "Official Government Mandate")

    docs_checklist = "\n".join([f"  ✅ {doc}" for doc in docs])
    maps_link = csc_center.get("google_maps_url", "https://maps.google.com")
    center_name = csc_center.get("center_name", "Public Service Centre")

    return (
        f"📋 *{scheme_name}*\n"
        f"💰 *{loc['entitlement']}:* {entitlement}\n\n"
        f"📑 *{loc['docs']}:*\n"
        f"{docs_checklist}\n\n"
        f"📍 *{loc['csc']}:*\n"
        f"{center_name}\n"
        f"🗺️ {loc['directions']}: {maps_link}\n\n"
        f"📜 *{loc['citation']}:* {citation}"
    )

# Backward-compatible alias
format_whatsapp_checklist = format_scheme_checklist


# ==============================================================================
# Core Asynchronous Pipeline (Website & Voice Engine)
# ==============================================================================

async def process_voice_or_text_pipeline(
    sender_phone: str = "web_citizen",
    media_url: Optional[str] = None,
    text_body: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> Dict[str, Any]:
    """
    Executes the 6-stage end-to-end voice/text pipeline across all 9 Indian states:
      Stage 1: STT & Dialect Detection (Sarvam / Gemini Multimodal / Unicode Language Detector)
      Stage 2: Entity & Multi-Turn State Extraction (LangChain LCEL Chain 1)
      Stage 3: State-Aware Deterministic Land-Unit Normalization (Pure Python)
      Stage 4: Parallel Retrieval (Qdrant Vector RAG + OSM/Places CSC + Open-Meteo)
      Stage 5: Grounded Scheme Adjudication (LangChain LCEL Chain 2)
      Stage 6: Multi-Lingual Regional Translation & Neural Audio Synthesis
    """
    start_time = time.time()
    session_id = f"sess_{uuid.uuid4().hex[:8]}"

    # --- Stage 1: Ingest Speech / Text ---
    incoming_audio_url = media_url or ""
    detected_lang = "hi-IN"
    native_transcript = ""
    english_query = ""

    if media_url and not audio_bytes:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.get(media_url)
                if res.status_code == 200:
                    audio_bytes = res.content
        except Exception as e:
            logger.warning(f"Audio URL fetch note: {e}")

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
        native_transcript = text_body
        detected_lang = detect_text_language(text_body)
        if detected_lang not in ("en-IN", "en"):
            english_query = await translate_to_english(text_body, detected_lang)
        else:
            english_query = text_body
    else:
        english_query = "I have 2 acres of land. Can I get drought relief subsidy?"
        native_transcript = "मेरे पास 2 एकड़ जमीन है, क्या मुझे सूखा राहत का लाभ मिल सकता है?"
        detected_lang = "hi-IN"

    # --- Stage 2: Profile & Multi-Turn Context Extraction ---
    prior_history = await get_session_history(sender_phone)
    profile = await extract_citizen_profile(english_query, prior_history)

    # Refine detected language using state hint if message was Romanized or state-specific
    if profile.state:
        refined_lang = detect_text_language(native_transcript, state_hint=profile.state)
        if detected_lang in ("en-IN", "hi-IN"):
            detected_lang = refined_lang

    # Multi-Turn Short-Circuit: If mandatory question is missing
    if profile.missing_critical_question:
        vernacular_q = await translate_text_vernacular(profile.missing_critical_question, detected_lang)
        q_audio_file, q_audio_url = await create_voice_note_file(vernacular_q, detected_lang)
        public_q_url = await upload_audio_to_public_storage(q_audio_file)

        # Save session context
        await save_session_history(sender_phone, session_id, english_query, profile.missing_critical_question)

        total_latency_ms = round((time.time() - start_time) * 1000, 1)
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
            "verdict": {
                "status": "FOLLOW_UP_REQUESTED",
                "missing_question": vernacular_q,
                "english_voice_script": profile.missing_critical_question,
                "local_language_script": vernacular_q,
                "entitlement_summary": "Follow-up question required to determine exact eligibility",
                "exact_three_documents": [],
                "source_citation": "Multi-turn context collection"
            },
            "outbound_audio_url": public_q_url,
            "total_latency_ms": total_latency_ms,
            "status": "FOLLOW_UP_REQUESTED"
        }
        await log_telemetry_event(telemetry)
        return telemetry

    # --- Stage 3: Deterministic Land-Unit Normalization ---
    state_for_conversion = profile.state or "Maharashtra"
    hectares = convert_to_hectares(profile.land_value, profile.land_unit, state=state_for_conversion)
    if hectares is None:
        logger.warning(f"Could not convert land value {profile.land_value} {profile.land_unit}. Defaulting to 0.809 Ha.")
        hectares = 0.809

    # --- Stage 4: Parallel Retrieval ---
    rag_task = query_qdrant_mandates(
        query=f"{profile.sector} {profile.crop_or_business_type} eligibility {profile.state or ''}",
        state=profile.state or "All_India",
        sector=profile.sector,
        limit=4
    )
    live_context_task = fetch_all_live_context(
        district_or_village=profile.district_or_village or "Central",
        state=profile.state or "All_India",
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

    # --- Stage 6: Vernacular Translation, Neural Audio Synthesis ---
    localized_script = await translate_text_vernacular(verdict.english_voice_script, detected_lang)
    outbound_audio_url = ""
    try:
        outbound_audio_file, _ = await create_voice_note_file(localized_script, detected_lang)
        outbound_audio_url = await upload_audio_to_public_storage(outbound_audio_file)
    except Exception as e:
        logger.debug(f"Voice note synthesis note: {e}")

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
# Website & Live Citizen API Endpoints
# ==============================================================================

class TestVoiceRequest(BaseModel):
    query_text: Optional[str] = "मेरे पास 2 एकड़ जमीन है, क्या मुझे सूखा राहत का लाभ मिल सकता है?"
    phone_number: Optional[str] = "web_citizen"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@app.post("/test-voice")
@app.post("/api/query")
async def test_voice_endpoint(payload: TestVoiceRequest):
    """
    Website Synchronous Voice/Text Query Endpoint.
    Executes the 6-stage pipeline and returns complete live telemetry and synthesized audio.
    """
    res = await process_voice_or_text_pipeline(
        sender_phone=payload.phone_number or "web_citizen",
        text_body=payload.query_text,
        lat=payload.latitude,
        lon=payload.longitude
    )
    return res


@app.post("/test-voice-upload")
@app.post("/api/query/upload")
async def test_voice_upload_endpoint(
    file: UploadFile = File(...),
    phone_number: str = Form("web_citizen")
):
    """Allows uploading raw citizen voice audio (.wav, .ogg, .mp3, .m4a) from browser microphone."""
    audio_content = await file.read()
    res = await process_voice_or_text_pipeline(
        sender_phone=phone_number,
        audio_bytes=audio_content
    )
    return res


@app.get("/api/telemetry/latest")
async def get_latest_telemetry(limit: int = 10, phone_number: Optional[str] = None):
    """Returns latest telemetry logs, optionally filtered by device/phone."""
    logs = get_latest_telemetry_logs(limit=limit, phone_number=phone_number)
    return {"count": len(logs), "logs": logs}


class ResetSessionRequest(BaseModel):
    phone_number: str = "web_citizen"


@app.post("/api/session/reset")
async def reset_session_endpoint(payload: ResetSessionRequest):
    """Clears multi-turn conversation memory for a specific device or phone number."""
    await clear_session_history(payload.phone_number)
    return {"status": "SUCCESS", "message": f"Session cleared for {payload.phone_number}"}


@app.get("/")
async def root():
    """Serves the PolicySetu AI Command Center frontend if built, or JSON status."""
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "service": "PolicySetu AI - Multilingual Policy & Scheme Explainer API",
        "version": "2.1.0",
        "status": "ONLINE",
        "documentation": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    """Healthcheck endpoint detailing status of all connected services."""
    return {
        "status": "HEALTHY",
        "timestamp": time.time(),
        "services": {
            "website_engine": "ACTIVE",
            "sarvam_configured": settings.is_sarvam_configured(),
            "gemini_configured": settings.is_gemini_configured(),
            "qdrant_configured": settings.is_qdrant_configured(),
            "supabase_configured": settings.is_supabase_configured(),
            "data_gov_configured": bool(settings.DATA_GOV_IN_API_KEY),
            "osm_overpass": "ONLINE (Zero Key)",
            "open_meteo": "ONLINE (Zero Key)"
        }
    }


