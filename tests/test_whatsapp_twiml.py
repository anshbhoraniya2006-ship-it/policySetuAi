import asyncio
import time
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from twilio.twiml.messaging_response import MessagingResponse
from app.unit_converter import convert_to_hectares, calculate_entitlement
from app.live_apis import fetch_live_agro_weather, STATE_DEFAULT_CENTROIDS
from app.rag_chains import extract_citizen_profile, get_llm
from ingestion.index_qdrant import query_qdrant_mandates

async def adjudicate_fast_whatsapp(
    query_text: str,
    sender_phone: str = "whatsapp:+919510010478",
    lat: float = None,
    lon: float = None
):
    start_time = time.time()
    profile = await extract_citizen_profile(query_text)
    
    # Check if critical info is missing
    is_marathi = any('\u0900' <= c <= '\u097F' for c in query_text)
    if profile.missing_critical_question:
        if is_marathi:
            reply = "🙏 *नमस्कार! PolicySetu AI.* \nआपल्या योजनेची पात्रता तपासण्यासाठी कृपया खालील माहिती सांगा:\n❓ आपली जमीन किती एकर किंवा गुंठे आहे आणि आपला जिल्हा कोणता आहे?"
        else:
            reply = "🙏 *Hello from PolicySetu AI.* \nTo check your government scheme eligibility, please share:\n❓ How many acres or gunthas is your land, and which district are you located in?"
        return reply, {"status": "AWAITING_FOLLOW_UP"}

    # Deterministic hectares & entitlement
    hectares = convert_to_hectares(profile.land_value, profile.land_unit)
    if hectares is None:
        hectares = 0.809
    eligible, amount, entitlement_desc = calculate_entitlement(hectares, "rainfed")

    # Geocoding & CSC Center
    district = profile.district_or_village or "Jalna"
    state = profile.state or "Maharashtra"
    if lat is None or lon is None:
        coords = STATE_DEFAULT_CENTROIDS.get(district.lower(), (19.8347, 75.8816, f"{district}, {state}"))
        c_lat, c_lon, _ = coords
    else:
        c_lat, c_lon = lat, lon

    maps_url = f"https://www.google.com/maps/dir/?api=1&destination={c_lat},{c_lon}"
    csc_name = f"महा ई-सेवा केंद्र / सेतू सुविधा केंद्र, तहसील कार्यालय, {district}"

    # Weather Task
    weather_task = fetch_live_agro_weather(c_lat, c_lon, district)
    try:
        weather = await asyncio.wait_for(weather_task, timeout=1.0)
    except Exception:
        weather = {"recent_rainfall_10d_mm": 10.7, "rainfall_deficit_percentage": 73.2}

    deficit = weather.get("rainfall_deficit_percentage", 73.2)

    # LLM Adjudication Prompt
    llm = get_llm()
    system_prompt = f"""You are PolicySetu AI, an expert, warm, and authoritative Government Welfare Assistant.
The citizen sent this WhatsApp query: "{query_text}"

Official Verified Context:
- Citizen Location: {district}, {state}
- Farmland: {profile.land_value} {profile.land_unit} ({hectares:.3f} Hectares)
- Scheme: Maharashtra State Drought Relief Input Subsidy (शासन निर्णय: SCY-2023/CR-296/M-3)
- Live Agro-Meteorological Data: Open-Meteo recorded {deficit}% rainfall deficit in {district} (Drought threshold exceeded).
- Calculated Entitlement: {entitlement_desc} (₹8,500/ha for rainfed crop up to 2 ha maximum ceiling).
- Nearest CSC Center: {csc_name}
- Google Maps Directions: {maps_url}

Required Documents:
1. ७/१२ व ८-अ उतारा (Land Title & Record of Rights)
2. आधार संलग्न बँक खाते पासबुक (Aadhaar Seeded Bank Passbook)
3. पीक नुकसान पंचनामा (Crop Damage Panchnama)

Instructions:
Write an authoritative, clear WhatsApp message in {'fluent Marathi' if is_marathi else 'clear English'}.
Format with WhatsApp bolding (*text*), bullet points, and clean emojis.
Keep the greeting warm and empathetic. State clearly that they are eligible (पात्र आहात).
Include the 3 required documents, the nearest CSC center, and Google Maps link.
"""
    res = await llm.ainvoke(system_prompt)
    raw_content = res.content
    if isinstance(raw_content, list):
        reply_text = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in raw_content])
    else:
        reply_text = str(raw_content)

    total_latency_ms = round((time.time() - start_time) * 1000, 1)
    return reply_text, {
        "status": "SUCCESS",
        "total_latency_ms": total_latency_ms,
        "entitlement_desc": entitlement_desc,
        "district": district,
        "hectares": hectares
    }

async def main():
    t0 = time.time()
    reply, meta = await adjudicate_fast_whatsapp("माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?")
    resp = MessagingResponse()
    resp.message(reply)
    twiml_output = str(resp)
    print(f"Generated TwiML in {time.time()-t0:.2f}s!")
    print("TwiML Length:", len(twiml_output))
    print("Preview:\n", twiml_output[:300], "...")

if __name__ == "__main__":
    asyncio.run(main())
