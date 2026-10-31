"""
Test Suite for PolicySetu AI.
Tests:
  1. Unit Converter: Land conversions (Acre, Guntha, Bigha -> Hectares) and deterministic subsidy calculations.
  2. Live APIs: Open-Meteo rainfall telemetry and OpenStreetMap Nominatim geocoding.
  3. Structured RAG Schemas: Pydantic validation of CitizenProfile and SchemeVerdict.
  4. Multi-Turn Session Memory: SQLite conversation history persistence.
  5. FastAPI Endpoints: /health and /test-voice pipeline execution.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

# Ensure Windows terminal prints Devanagari and Indic scripts cleanly
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.unit_converter import convert_to_hectares, calculate_entitlement, is_small_marginal_farmer
from app.live_apis import geocode_location, fetch_live_agro_weather, find_nearest_csc
from app.rag_chains import CitizenProfile, SchemeVerdict, extract_citizen_profile, adjudicate_eligibility
from app.db_session import get_session_history, save_session_history, log_telemetry_event, get_latest_telemetry_logs


def test_unit_converter():
    print("[1/5] Testing Deterministic Unit Converter...")
    # 2 Acres -> 0.809 Hectares
    ha_acre = convert_to_hectares(2.0, "acre")
    assert ha_acre == 0.809, f"Expected 0.809, got {ha_acre}"

    # 40 Gunthas -> 0.405 Hectares
    ha_guntha = convert_to_hectares(40.0, "guntha")
    assert ha_guntha == 0.405, f"Expected 0.405, got {ha_guntha}"

    # 3 Bighas -> 0.759 Hectares
    ha_bigha = convert_to_hectares(3.0, "bigha")
    assert ha_bigha == 0.759, f"Expected 0.759, got {ha_bigha}"

    # Entitlement calculation
    eligible, amount, desc = calculate_entitlement(0.809, crop_type="rainfed")
    assert eligible is True
    assert amount == round(0.809 * 8500.0, 2)
    assert "₹6,876" in desc or "₹6,877" in desc

    assert is_small_marginal_farmer(0.809) is True
    assert is_small_marginal_farmer(3.5) is False
    print("  -> Unit Converter tests PASSED!")


async def test_live_apis():
    print("[2/5] Testing Live Public APIs (Rule 4 Compliance)...")
    # Geocoding via Nominatim
    lat, lon, place = await geocode_location("Jalna", "Maharashtra")
    assert lat is not None and lon is not None
    print(f"  -> Geocoded Jalna: lat={lat}, lon={lon}, place={place[:40]}...")

    # Live Weather via Open-Meteo (Zero Key)
    weather = await fetch_live_agro_weather(lat, lon, "Jalna")
    assert "recent_rainfall_10d_mm" in weather
    assert "rainfall_deficit_percentage" in weather
    print(f"  -> Open-Meteo Live: 10d Rain={weather['recent_rainfall_10d_mm']}mm, Deficit={weather['rainfall_deficit_percentage']}%")

    # Live CSC Locator
    csc = await find_nearest_csc(lat, lon, "Jalna", "Maharashtra")
    assert "center_name" in csc
    assert "google_maps_url" in csc
    print(f"  -> Nearest CSC: {csc['center_name'][:50]}")
    print("  -> Live APIs tests PASSED!")


async def test_rag_schemas():
    print("[3/5] Testing LangChain Schemas & Fallback Adjudication...")
    query = "I have 2 acres in Jalna, can I get drought compensation?"
    profile = await extract_citizen_profile(query)
    assert profile.district_or_village.lower() == "jalna"
    assert profile.land_value == 2.0

    hectares = convert_to_hectares(profile.land_value, profile.land_unit)
    csc = {"center_name": "Maha e-Seva Kendra, Jalna", "google_maps_url": "https://maps.google.com"}
    weather = {"rainfall_deficit_percentage": 65.0}

    verdict = await adjudicate_eligibility(
        profile=profile,
        hectares=hectares,
        rag_docs=[],
        csc_center=csc,
        agro_data=weather
    )
    assert verdict.is_eligible is True
    assert len(verdict.exact_three_documents) == 3
    assert "7/12" in verdict.exact_three_documents[0]
    print(f"  -> Adjudicated Scheme: {verdict.scheme_name[:50]}")
    print(f"  -> Required 3 Docs: {verdict.exact_three_documents}")
    print("  -> RAG Schemas & Adjudication tests PASSED!")


async def test_session_and_telemetry():
    print("[4/5] Testing Multi-Turn Session Memory & Telemetry...")
    test_phone = "whatsapp:+919999988888"
    await save_session_history(test_phone, "sess_test", "I am in Jalna", "Noted, how many acres do you own?")
    history = await get_session_history(test_phone)
    assert "Jalna" in history
    assert "Noted" in history

    await log_telemetry_event({
        "session_id": "sess_test_1",
        "phone_number": test_phone,
        "language_code": "mr-IN",
        "native_transcript": "माझ्याकडे २ एकर जमीन आहे",
        "english_translation": "I have 2 acres of land",
        "land_in_hectares": 0.809,
        "status": "SUCCESS"
    })
    logs = get_latest_telemetry_logs(limit=5)
    assert len(logs) > 0
    assert logs[0]["session_id"] == "sess_test_1"
    print("  -> Session & Telemetry tests PASSED!")


async def test_full_pipeline():
    print("[5/5] Testing Full End-to-End Voice/Text Pipeline...")
    from app.main import process_voice_or_text_pipeline
    telemetry = await process_voice_or_text_pipeline(
        sender_phone="whatsapp:+919999977777",
        text_body="माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?"
    )
    assert telemetry["status"] == "SUCCESS"
    assert telemetry["land_in_hectares"] == 0.809
    assert telemetry["verdict"]["is_eligible"] is True
    assert "outbound_audio_url" in telemetry
    print(f"  -> Pipeline executed in {telemetry['total_latency_ms']} ms")
    print("  -> Full Pipeline test PASSED!")


async def main():
    print("==================================================================")
    print("PolicySetu AI — Hackathon Integrity & Pipeline Verification")
    print("==================================================================")
    test_unit_converter()
    await test_live_apis()
    await test_rag_schemas()
    await test_session_and_telemetry()
    await test_full_pipeline()
    print("==================================================================")
    print("ALL TESTS PASSED! Ready for live hackathon demonstration.")
    print("==================================================================")


if __name__ == "__main__":
    asyncio.run(main())
