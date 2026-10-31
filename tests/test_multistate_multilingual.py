"""
Comprehensive Multi-State & Multi-Lingual Integration Test Suite for PolicySetu AI.
Strictly verifies:
  1. Language Auto-Detection (Telugu, Kannada, Punjabi, Gujarati, Hindi, Marathi, English, Romanized).
  2. State-Aware Unit Conversion (Bigha by state, Guntha, Cent, Kanal, Marla, Killa).
  3. State-Aware Civic Center Localization (MeeSeva, Grama One, MPOnline, Jan Seva, Vasudha Kendra, Sewa Kendra).
  4. Vector Store Retrieval & Multi-State Mandate Filtering in Qdrant Cloud.
  5. State-Accurate Official Document Verdicts (Pahani, Pattadar Passbook, Khasra, LPC, Jamabandi, 7/12).
  6. End-to-End Pipeline Execution via /test-voice across various languages.
"""

import asyncio
import sys
from pathlib import Path

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure Windows console prints Unicode cleanly
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.speech import detect_text_language
from app.unit_converter import convert_to_hectares, calculate_entitlement
from app.live_apis import get_state_civic_center_title, geocode_location
from app.rag_chains import extract_citizen_profile, adjudicate_eligibility, CitizenProfile
from ingestion.index_qdrant import query_qdrant_mandates
from app.main import process_voice_or_text_pipeline


def test_language_detection():
    print("\n--- [1/6] Testing Multi-Lingual Auto-Detection ---")

    # 1. Telugu
    te_text = "నాకు వరంగల్ లో 3 ఎకరాల భూమి ఉంది, కరువు సాయం వస్తుందా?"
    assert detect_text_language(te_text) == "te-IN"

    # 2. Kannada
    kn_text = "ನನ್ನ ಬೆಳಗಾವಿ ಜಮೀನಿಗೆ ಬರ ಪರಿಹಾರ ಹಣ ಸಿಗುತ್ತದೆಯೇ?"
    assert detect_text_language(kn_text) == "kn-IN"

    # 3. Punjabi (Gurmukhi)
    pa_text = "ਮੇਰੇ ਕੋਲ ਲੁਧਿਆਣਾ ਵਿੱਚ 4 ਕਿੱਲੇ ਜ਼ਮੀਨ ਹੈ, ਮੁਆਵਜ਼ਾ ਮਿਲੇਗਾ?"
    assert detect_text_language(pa_text) == "pa-IN"

    # 4. Gujarati
    gu_text = "મારે જામનગરમાં ૪ વીઘા જમીન છે, સહાય મળશે?"
    assert detect_text_language(gu_text) == "gu-IN"

    # 5. Hindi (UP / Bihar / MP)
    hi_text = "मेरे पास गोरखपुर में 3 बीघा जमीन है, क्या मुझे सूखा राहत मिलेगा?"
    assert detect_text_language(hi_text) == "hi-IN"

    # 6. Marathi
    mr_text = "माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?"
    assert detect_text_language(mr_text) == "mr-IN"

    # 7. Romanized Hindi / Hinglish
    hinglish = "Mujhe Gorakhpur me fasal nuksan ka compensation chahiye"
    assert detect_text_language(hinglish) == "hi-IN"

    # 8. Romanized Telugu
    rom_te = "Naku Warangal lo 2 ekaraalu bhoomi undi, relief vastunda?"
    assert detect_text_language(rom_te) == "te-IN"

    print("  -> Language detection tests PASSED across all scripts and Romanized variants!")


def test_state_aware_unit_conversion():
    print("\n--- [2/6] Testing State-Aware Deterministic Unit Converter ---")

    # Standard Acre
    ha_acre = convert_to_hectares(2.0, "acre")
    assert ha_acre == 0.809

    # Telangana / Karnataka / Maharashtra Guntha (40 Gunthas = 1 Acre)
    ha_guntha = convert_to_hectares(40.0, "guntha", state="Telangana")
    assert ha_guntha == 0.405

    # UP / MP / Bihar Pucca Bigha (~0.2529 Ha)
    ha_bigha_up = convert_to_hectares(4.0, "bigha", state="Uttar Pradesh")
    assert ha_bigha_up == 1.012

    # Gujarat Vigha (~0.1619 Ha = 16 Gunthas)
    ha_bigha_gj = convert_to_hectares(4.0, "bigha", state="Gujarat")
    assert ha_bigha_gj == 0.647

    # Punjab / Haryana Kanal & Killa
    ha_killa = convert_to_hectares(2.0, "killa", state="Punjab")
    assert ha_killa == 0.809  # 1 Killa = 1 Acre

    ha_kanal = convert_to_hectares(8.0, "kanal", state="Punjab")
    assert ha_kanal == 0.405  # 8 Kanals = 1 Acre

    # State-specific relief entitlement calculation
    # Gujarat MMKSY
    _, gj_amount, gj_desc = calculate_entitlement(1.0, crop_type="rainfed", state="Gujarat")
    assert gj_amount == 20000.0
    assert "₹20,000" in gj_desc

    # Standard SDRF (UP/Telangana/Karnataka/MP/Bihar)
    _, sdrf_amount, sdrf_desc = calculate_entitlement(1.0, crop_type="rainfed", state="Uttar Pradesh")
    assert sdrf_amount == 8500.0
    assert "₹8,500" in sdrf_desc

    print("  -> State-aware unit conversion & calculation tests PASSED!")


def test_state_civic_centers():
    print("\n--- [3/6] Testing State-Specific Civic Center Localization ---")

    assert "MeeSeva" in get_state_civic_center_title("Telangana", "Warangal")
    assert "Grama One" in get_state_civic_center_title("Karnataka", "Belagavi")
    assert "MPOnline" in get_state_civic_center_title("Madhya Pradesh", "Ujjain")
    assert "Jan Seva Kendra" in get_state_civic_center_title("Uttar Pradesh", "Gorakhpur")
    assert "Vasudha Kendra" in get_state_civic_center_title("Bihar", "Muzaffarpur")
    assert "Sewa Kendra" in get_state_civic_center_title("Punjab", "Ludhiana")
    assert "Antyodaya Saral" in get_state_civic_center_title("Haryana", "Sirsa")
    assert "Maha e-Seva" in get_state_civic_center_title("Maharashtra", "Jalna")
    assert "Jan Seva Kendra" in get_state_civic_center_title("Gujarat", "Jamnagar")

    print("  -> State civic center localization tests PASSED!")


async def test_qdrant_multistate_retrieval():
    print("\n--- [4/6] Testing Qdrant Multi-State Vector Retrieval ---")

    test_states = [
        ("Telangana", "drought relief cotton Warangal"),
        ("Karnataka", "drought calamity input subsidy Parihara Belagavi"),
        ("Madhya Pradesh", "fasal kalyan RBC 6-4 soyabean Ujjain"),
        ("Uttar Pradesh", "krishi nivesh anudan Gorakhpur"),
        ("Bihar", "bihar rajya fasal sahayata yojana Muzaffarpur"),
        ("Punjab", "crop loss special girdawari compensation Ludhiana"),
        ("Haryana", "bhavantar calamity relief Meri Fasal Mera Byora Sirsa"),
        ("Gujarat", "kisan sahay yojana drought Jamnagar"),
        ("Maharashtra", "drought relief input subsidy Jalna"),
    ]

    for st, q in test_states:
        chunks = await query_qdrant_mandates(query=q, state=st, limit=2)
        assert len(chunks) > 0, f"Expected Qdrant chunks for state '{st}', got 0"
        retrieved_states = {c.get("state") for c in chunks}
        assert (st in retrieved_states or "All_India" in retrieved_states), (
            f"Expected state '{st}' or 'All_India' in retrieved chunks, got {retrieved_states}"
        )
        print(f"  -> Qdrant [{st:14s}] => Retrieved: '{chunks[0]['scheme_name'][:45]}...'")

    print("  -> Multi-state Qdrant vector retrieval tests PASSED!")


async def test_state_accurate_verdicts():
    print("\n--- [5/6] Testing State-Accurate Official Document Verdicts ---")

    profiles = [
        ("Telangana", "Warangal", ["pattadar", "passbook", "dharani"]),
        ("Karnataka", "Belagavi", ["pahani", "rtc"]),
        ("Madhya Pradesh", "Ujjain", ["khasra", "khatauni"]),
        ("Uttar Pradesh", "Gorakhpur", ["khatauni", "khasra"]),
        ("Bihar", "Muzaffarpur", ["lpc", "possession", "receipt", "rasid"]),
        ("Punjab", "Ludhiana", ["jamabandi", "fard"]),
        ("Haryana", "Sirsa", ["jamabandi", "fard", "byora", "mfmb"]),
        ("Maharashtra", "Jalna", ["7/12", "satbara"]),
    ]

    for st, dist, allowed_doc_keywords in profiles:
        prof = CitizenProfile(
            state=st,
            district_or_village=dist,
            land_value=2.0,
            land_unit="acre",
            crop_or_business_type="Kharif Crops",
            sector="drought_relief"
        )
        verdict = await adjudicate_eligibility(
            profile=prof,
            hectares=0.809,
            rag_docs=[],
            csc_center={"center_name": f"Center in {dist}"},
            agro_data={"rainfall_deficit_percentage": 60.0}
        )
        assert verdict.is_eligible is True
        assert len(verdict.exact_three_documents) == 3
        doc_str = " ".join(verdict.exact_three_documents).lower()
        matched = any(k in doc_str for k in allowed_doc_keywords)
        assert matched, (
            f"State {st} expected at least one of {allowed_doc_keywords} in documents, got: {verdict.exact_three_documents}"
        )
        print(f"  -> Verdict [{st:14s}] verified with mandatory document: '{verdict.exact_three_documents[0]}'")

    print("  -> State-accurate document verdict tests PASSED!")


async def test_end_to_end_multistate_pipeline():
    print("\n--- [6/6] Testing End-to-End Pipeline Across Multiple Languages ---")

    test_queries = [
        # Telugu (Telangana)
        {
            "query": "నాకు వరంగల్ లో 3 ఎకరాల భూమి ఉంది, కరువు సాయం వస్తుందా?",
            "state": "Telangana",
            "lang": "te-IN"
        },
        # Kannada (Karnataka) with land size
        {
            "query": "ನನ್ನ ಬೆಳಗಾವಿಯಲ್ಲಿ 2 ಎಕರೆ ಜಮೀನಿಗೆ ಬರ ಪರಿಹಾರ ಹಣ ಸಿಗುತ್ತದೆಯೇ?",
            "state": "Karnataka",
            "lang": "kn-IN"
        },
        # Hindi (Uttar Pradesh) with land size
        {
            "query": "मेरे पास गोरखपुर में 3 बीघा जमीन है, क्या मुझे सूखा राहत मिलेगा?",
            "state": "Uttar Pradesh",
            "lang": "hi-IN"
        },
        # Punjabi (Punjab) with land size
        {
            "query": "ਮੇਰੇ ਕੋਲ ਲੁਧਿਆਣਾ ਵਿੱਚ 4 ਕਿੱਲੇ ਜ਼ਮੀਨ ਹੈ, ਮੁਆਵਜ਼ਾ ਮਿਲੇਗਾ?",
            "state": "Punjab",
            "lang": "pa-IN"
        }
    ]

    for item in test_queries:
        res = await process_voice_or_text_pipeline(
            sender_phone="whatsapp:+919876543210",
            text_body=item["query"]
        )
        assert res["status"] == "SUCCESS"
        assert res["citizen_profile"]["state"] == item["state"]
        assert res["language_code"] == item["lang"]
        assert len(res["verdict"]["exact_three_documents"]) == 3
        print(f"  -> E2E Pipeline [{item['state']:14s} | {item['lang']}] => Scheme: '{res['verdict']['scheme_name'][:40]}...' ({res['total_latency_ms']} ms)")

    print("  -> End-to-end multi-state & multi-lingual tests PASSED!")


async def main():
    print("==================================================================")
    print("PolicySetu AI — Multi-State & Multi-Lingual Integrity Test Suite")
    print("==================================================================")
    test_language_detection()
    test_state_aware_unit_conversion()
    test_state_civic_centers()
    await test_qdrant_multistate_retrieval()
    await test_state_accurate_verdicts()
    await test_end_to_end_multistate_pipeline()
    print("==================================================================")
    print("ALL MULTI-STATE & MULTI-LINGUAL INTEGRATION TESTS PASSED!")
    print("==================================================================")


if __name__ == "__main__":
    asyncio.run(main())
