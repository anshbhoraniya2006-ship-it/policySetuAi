import asyncio
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.main import process_voice_or_text_pipeline

async def test_website_query_flow():
    print("Testing website query flow across regional dialects...")

    # Test 1: Gujarat MMKSY
    res_gu = await process_voice_or_text_pipeline(
        sender_phone="web_citizen_01",
        text_body="મારી પાસે જામનગરમાં 50 વીઘા જમીન છે, શું મને સહાય મળશે?",
        lat=22.4707,
        lon=70.0577
    )
    assert res_gu["status"] == "SUCCESS", f"Expected SUCCESS, got {res_gu['status']}"
    assert res_gu["citizen_profile"]["state"] == "Gujarat"
    assert "Gujarat" in res_gu["verdict"]["scheme_name"] or "Kisan" in res_gu["verdict"]["scheme_name"]
    print(f"✅ Gujarat Test Passed: {res_gu['verdict']['entitlement_summary']}")

    # Test 2: Maharashtra Drought Relief
    res_mr = await process_voice_or_text_pipeline(
        sender_phone="web_citizen_02",
        text_body="माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?",
        lat=19.8347,
        lon=75.8816
    )
    assert res_mr["status"] == "SUCCESS", f"Expected SUCCESS, got {res_mr['status']}"
    assert res_mr["citizen_profile"]["state"] == "Maharashtra"
    print(f"✅ Maharashtra Test Passed: {res_mr['verdict']['entitlement_summary']}")

    print("All website query tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_website_query_flow())

