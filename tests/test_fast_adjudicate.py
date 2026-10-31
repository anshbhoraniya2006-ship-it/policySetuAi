import asyncio
import time
import sys
from pathlib import Path

# Add project root to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.rag_chains import get_llm
from app.unit_converter import convert_to_hectares, calculate_entitlement

async def test_fast():
    t0 = time.time()
    llm = get_llm()
    query = 'माझ्याकडे जालन्यात २ एकर जमीन आहे, मला दुष्काळ निधी मिळेल का?'
    ha = convert_to_hectares(2.0, 'acre')
    _, amt, desc = calculate_entitlement(ha, 'rainfed')
    
    prompt = f"""You are PolicySetu AI, an empathetic Indian government welfare adjudicator.
The citizen asked: "{query}" (Marathi).

Context:
- District: Jalna, State: Maharashtra
- Land: 2 Acres ({ha} Hectares)
- Entitlement: {desc} (Under Maharashtra Drought Relief GR SCY-2023/CR-296/M-3)
- Rainfall Deficit: 73.2%
- Nearest Center: Maha e-Seva Kendra, Tehsil Office, Jalna (https://www.google.com/maps/dir/?api=1&destination=19.8347,75.8816)

Format an immediate, friendly, authoritative WhatsApp response in fluent Marathi.
Include:
1. Warm greeting and eligibility confirmation (पात्र आहात).
2. Scheme Name & Calculated Entitlement ({desc}).
3. Exactly 3 required documents (7/12 Utara, Aadhaar bank passbook, Panchnama).
4. Nearest CSC Kendra with directions link.
5. Official GR Citation.
"""
    res = await llm.ainvoke(prompt)
    print(f"Done in {time.time()-t0:.2f}s")
    print("Response:\n" + str(res.content))

if __name__ == "__main__":
    asyncio.run(test_fast())
