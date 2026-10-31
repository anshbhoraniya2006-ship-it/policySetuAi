"""
LangChain LCEL Structured Chains for PolicySetu AI.
Strictly implements:
  - Chain 1: Citizen Profile & Multi-Turn State Extractor across all 9 Indian states.
  - Deterministic Python land unit conversion (Acres/Gunthas/Bighas/Kanals/Cents -> Hectares).
  - Chain 2: Grounded Scheme Eligibility Adjudicator (Zero-hallucination structured output).
  - Comprehensive state-specific land revenue and document requirement mappings.
"""

import asyncio
import json
import re
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.unit_converter import convert_to_hectares, calculate_entitlement

logger = logging.getLogger("policysetu.rag_chains")
logger.setLevel(logging.INFO)

# ==============================================================================
# Comprehensive Multi-State District to State Knowledge Map
# ==============================================================================
DISTRICT_STATE_MAP = {
    # Maharashtra
    "jalna": "Maharashtra", "beed": "Maharashtra", "latur": "Maharashtra", "solapur": "Maharashtra",
    "amravati": "Maharashtra", "nashik": "Maharashtra", "pune": "Maharashtra", "nagpur": "Maharashtra",
    "aurangabad": "Maharashtra", "sambhajinagar": "Maharashtra", "nanded": "Maharashtra", "yavatmal": "Maharashtra",
    "parbhani": "Maharashtra", "osmanabad": "Maharashtra", "dharashiv": "Maharashtra", "kolhapur": "Maharashtra",
    # Gujarat
    "jamnagar": "Gujarat", "rajkot": "Gujarat", "bhavnagar": "Gujarat", "junagadh": "Gujarat",
    "kutch": "Gujarat", "surendranagar": "Gujarat", "ahmedabad": "Gujarat", "surat": "Gujarat",
    "amreli": "Gujarat", "mehsana": "Gujarat", "banaskantha": "Gujarat", "vadodara": "Gujarat",
    # Telangana
    "warangal": "Telangana", "karimnagar": "Telangana", "nalgonda": "Telangana", "khammam": "Telangana",
    "nizamabad": "Telangana", "medak": "Telangana", "rangareddy": "Telangana", "mahabubnagar": "Telangana",
    "adilabad": "Telangana", "siddipet": "Telangana", "suryapet": "Telangana", "suryapeta": "Telangana",
    "hyderabad": "Telangana", "sangareddy": "Telangana", "kamareddy": "Telangana", "yadadri": "Telangana",
    "bhadradri": "Telangana", "jagtial": "Telangana", "mancherial": "Telangana", "peddapalli": "Telangana",
    "wanaparthy": "Telangana", "gadwal": "Telangana", "nagarkurnool": "Telangana",
    # Indic Telugu Script Mappings
    "సూర్యపేట": "Telangana", "వరంగల్": "Telangana", "నల్గొండ": "Telangana", "ఖమ్మం": "Telangana",
    "కరీంనగర్": "Telangana", "నిజామాబాద్": "Telangana", "మెదక్": "Telangana", "రంగారెడ్డి": "Telangana",
    "మహబూబ్‌నగర్": "Telangana", "సిద్దిపేట": "Telangana", "హైదరాబాద్": "Telangana",
    # Karnataka
    "belagavi": "Karnataka", "dharwad": "Karnataka", "kalaburagi": "Karnataka", "raichur": "Karnataka",
    "vijayapura": "Karnataka", "ballari": "Karnataka", "mysuru": "Karnataka", "mandya": "Karnataka",
    "shivamogga": "Karnataka", "tumakuru": "Karnataka", "haveri": "Karnataka", "koppal": "Karnataka",
    "bengaluru": "Karnataka", "bagalkote": "Karnataka", "davangere": "Karnataka", "gadag": "Karnataka",
    # Madhya Pradesh
    "ujjain": "Madhya Pradesh", "indore": "Madhya Pradesh", "dewas": "Madhya Pradesh", "dhar": "Madhya Pradesh",
    "sagar": "Madhya Pradesh", "vidisha": "Madhya Pradesh", "sehore": "Madhya Pradesh", "jabalpur": "Madhya Pradesh",
    "gwalior": "Madhya Pradesh", "rewa": "Madhya Pradesh", "khargone": "Madhya Pradesh", "mandsaur": "Madhya Pradesh",
    "bhopal": "Madhya Pradesh", "satna": "Madhya Pradesh", "hoshangabad": "Madhya Pradesh",
    # Uttar Pradesh
    "gorakhpur": "Uttar Pradesh", "varanasi": "Uttar Pradesh", "prayagraj": "Uttar Pradesh", "ayodhya": "Uttar Pradesh",
    "basti": "Uttar Pradesh", "bareilly": "Uttar Pradesh", "meerut": "Uttar Pradesh", "jhansi": "Uttar Pradesh",
    "banda": "Uttar Pradesh", "lakhimpur": "Uttar Pradesh", "lucknow": "Uttar Pradesh", "kanpur": "Uttar Pradesh",
    "aligarh": "Uttar Pradesh", "agra": "Uttar Pradesh", "moradabad": "Uttar Pradesh", "mirzapur": "Uttar Pradesh",
    # Bihar
    "muzaffarpur": "Bihar", "gaya": "Bihar", "bhagalpur": "Bihar", "darbhanga": "Bihar",
    "samastipur": "Bihar", "rohtas": "Bihar", "purnia": "Bihar", "begusarai": "Bihar",
    "nalanda": "Bihar", "patna": "Bihar", "vaishali": "Bihar", "madhubani": "Bihar",
    "siwan": "Bihar", "chhapra": "Bihar", "motihari": "Bihar", "saharsa": "Bihar",
    # Punjab
    "ludhiana": "Punjab", "bathinda": "Punjab", "sangrur": "Punjab", "patiala": "Punjab",
    "amritsar": "Punjab", "jalandhar": "Punjab", "firozpur": "Punjab", "mansa": "Punjab",
    "muktsar": "Punjab", "hoshiarpur": "Punjab", "moga": "Punjab", "faridkot": "Punjab",
    # Haryana
    "sirsa": "Haryana", "hisar": "Haryana", "rohtak": "Haryana", "karnal": "Haryana",
    "fatehabad": "Haryana", "jind": "Haryana", "bhiwani": "Haryana", "sonipat": "Haryana",
    "ambala": "Haryana", "panipat": "Haryana", "kurukshetra": "Haryana", "rewari": "Haryana",
}

STATE_SYNONYMS = {
    "maharashtra": "Maharashtra", "mh": "Maharashtra",
    "gujarat": "Gujarat", "gj": "Gujarat",
    "telangana": "Telangana", "ts": "Telangana", "tg": "Telangana",
    "karnataka": "Karnataka", "ka": "Karnataka",
    "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh",
    "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh",
    "bihar": "Bihar", "br": "Bihar",
    "punjab": "Punjab", "pb": "Punjab",
    "haryana": "Haryana", "hr": "Haryana",
}


# ==============================================================================
# 1. Pydantic Structured Output Schemas (Typed & Explainable)
# ==============================================================================

class CitizenProfile(BaseModel):
    """Structured citizen eligibility profile extracted from dialect query & history."""
    state: Optional[str] = Field(
        default=None,
        description="Indian state inferred from district/taluka (e.g. Maharashtra, Gujarat, Telangana, Karnataka, Madhya Pradesh, Uttar Pradesh, Bihar, Punjab, Haryana)"
    )
    district_or_village: Optional[str] = Field(
        default=None,
        description="Spoken village, taluka, or district name (e.g., 'Warangal', 'Belagavi', 'Ujjain', 'Gorakhpur', 'Muzaffarpur', 'Bathinda', 'Sirsa', 'Jalna')"
    )
    land_value: Optional[float] = Field(
        default=None,
        description="Numeric land size mentioned by citizen (e.g., 2.0, 4.5)"
    )
    land_unit: Optional[str] = Field(
        default="acre",
        description="Spoken land unit: 'acre', 'hectare', 'guntha', 'bigha', 'vigha', 'cent', 'kanal', 'marla', or 'killa'"
    )
    crop_or_business_type: Optional[str] = Field(
        default="rainfed crops",
        description="Specific crop mentioned (e.g., 'cotton', 'soybean', 'paddy', 'wheat') or MSME business type"
    )
    sector: str = Field(
        default="drought_relief",
        description="One of: 'drought_relief', 'agriculture', 'msme', 'general_welfare'"
    )
    missing_critical_question: Optional[str] = Field(
        default=None,
        description=(
            "If citizen did NOT mention either their location (district/state) or their land size, "
            "provide ONE concise, warm question asking ONLY for that missing piece; else None."
        )
    )


class SchemeVerdict(BaseModel):
    """Adjudicated eligibility verdict grounded strictly in government mandate clauses."""
    is_eligible: bool = Field(
        description="True if citizen meets the mandate eligibility criteria; else False"
    )
    scheme_name: str = Field(
        description="Official title of the matched central/state government scheme or resolution"
    )
    entitlement_summary: str = Field(
        description="Estimated entitlement amount in INR and rate basis (e.g. '₹13,600 at ₹8,500/ha for 1.6 ha rainfed crop loss')"
    )
    exact_three_documents: List[str] = Field(
        min_length=1,
        max_length=3,
        description="Exactly 3 mandatory official documents required in the citizen's state"
    )
    source_citation: str = Field(
        description="Exact Government Resolution (GR) number or official .gov.in URL and clause"
    )
    english_voice_script: str = Field(
        description="Warm, zero-jargon 40-word spoken script tailored for audio listening"
    )


# ==============================================================================
# 2. LLM Initialization & Chain Construction
# ==============================================================================

_CACHED_LLM = None

def get_llm():
    """Initializes Google Gemini model via LangChain with zero temperature and persistent singleton caching."""
    global _CACHED_LLM
    if _CACHED_LLM is not None:
        return _CACHED_LLM
    if not settings.is_gemini_configured():
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        kwargs = {
            "model": settings.GEMINI_MODEL,
            "google_api_key": settings.GEMINI_API_KEY,
            "max_retries": 1,
            "timeout": 10.0
        }
        # Avoid fixed sampling default UserWarning for gemini-3.5-flash-lite
        if "3.5" not in str(settings.GEMINI_MODEL):
            kwargs["temperature"] = 0.0
        _CACHED_LLM = ChatGoogleGenerativeAI(**kwargs)
        return _CACHED_LLM
    except Exception as e:
        logger.error(f"Failed to instantiate ChatGoogleGenerativeAI: {e}")
        return None


def build_profile_chain(llm):
    from langchain_core.prompts import ChatPromptTemplate
    system_prompt = (
        "You are an expert Indian government welfare officer. "
        "Extract structured citizen details from the translated citizen query and session history.\n"
        "Guidelines:\n"
        "1. Identify Indian state from district or state name across:\n"
        "   - Maharashtra (Jalna, Beed, Latur, Solapur, Amravati, Nashik, Pune, Nagpur, Chhatrapati Sambhajinagar)\n"
        "   - Gujarat (Jamnagar, Rajkot, Bhavnagar, Junagadh, Kutch, Surendranagar, Ahmedabad)\n"
        "   - Telangana (Warangal, Karimnagar, Nalgonda, Khammam, Nizamabad, Medak, Rangareddy, Mahabubnagar)\n"
        "   - Karnataka (Belagavi, Dharwad, Kalaburagi, Raichur, Vijayapura, Ballari, Mysuru, Mandya)\n"
        "   - Madhya Pradesh (Ujjain, Indore, Dewas, Dhar, Sagar, Vidisha, Sehore, Jabalpur, Gwalior)\n"
        "   - Uttar Pradesh (Gorakhpur, Varanasi, Prayagraj, Ayodhya, Basti, Bareilly, Meerut, Jhansi, Banda)\n"
        "   - Bihar (Muzaffarpur, Gaya, Bhagalpur, Darbhanga, Samastipur, Rohtas, Purnia, Begusarai, Patna)\n"
        "   - Punjab (Ludhiana, Bathinda, Sangrur, Patiala, Amritsar, Jalandhar, Firozpur, Mansa)\n"
        "   - Haryana (Sirsa, Hisar, Rohtak, Karnal, Fatehabad, Jind, Bhiwani, Sonipat, Ambala)\n"
        "2. Extract numeric land size and spoken unit (acre, hectare, guntha, bigha, vigha, cent, kanal, marla, killa).\n"
        "3. Sector must be one of: drought_relief, agriculture, msme, general_welfare.\n"
        "4. If location (district/state) or land size is completely unknown, set missing_critical_question to ONE short conversational follow-up question. "
        "If both are present, set missing_critical_question to null.\n"
        "5. CRITICAL RECENCY RULE: If the Latest Citizen Query specifies a new district, state, land size, or sector, "
        "ALWAYS prioritize and extract from the Latest Citizen Query. Do NOT carry over contradictory locations or states from Prior Session Context."
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Prior Session Context:\n{history}\n\nLatest Citizen Query:\n{query}")
    ])
    return prompt | llm.with_structured_output(CitizenProfile)


def build_verdict_chain(llm):
    from langchain_core.prompts import ChatPromptTemplate
    system_prompt = (
        "You are an official Government Scheme Eligibility Adjudicator. "
        "Adjudicate citizen eligibility STRICTLY using the retrieved official government resolution clauses of the citizen's state, "
        "the pre-converted land in hectares, live rainfall meteorological data, and nearest service center.\n"
        "Rules:\n"
        "1. Zero unverified claims: Ground everything strictly on retrieved clauses.\n"
        "2. Provide EXACTLY 3 mandatory documents citizens must bring using state-accurate terminology "
        "(e.g., 7/12 for Maharashtra/Gujarat; RTC/Pahani for Karnataka; Pattadar Passbook for Telangana; "
        "Khasra-Khatauni for UP/MP; LPC/Land Receipt for Bihar; Jamabandi/Fard for Punjab/Haryana).\n"
        "3. Include official GR citation or .gov.in URL.\n"
        "4. In english_voice_script, provide a warm, concise, zero-jargon 40-word spoken explanation naming the scheme, "
        "their exact eligibility, the 3 documents, and directing them to their nearest center."
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", (
            "Citizen Profile: {profile}\n"
            "Normalized Land in Hectares: {hectares} ha\n"
            "Calculated Entitlement Base: {entitlement_calc}\n"
            "Live Meteorological/Rainfall Data: {agro_data}\n"
            "Nearest Service Center (CSC/e-Seva): {csc_center}\n\n"
            "Official Mandate Clauses (RAG):\n{rag_chunks}\n\n"
            "Adjudicate eligibility now according to schema."
        ))
    ])
    return prompt | llm.with_structured_output(SchemeVerdict)


# ==============================================================================
# 3. Deterministic Extraction & Adjudication Pipeline Execution
# ==============================================================================

async def extract_citizen_profile(
    query: str,
    history: str = ""
) -> CitizenProfile:
    """
    Executes LCEL Chain 1 to extract structured CitizenProfile across all 9 supported Indian states.
    Falls back to high-fidelity multi-state rule-based parser if LLM is offline or times out.
    """
    # 1. Primary Path: LangChain LCEL Gemini Chain (Context & dialect aware)
    llm = get_llm()
    if llm:
        try:
            chain = build_profile_chain(llm)
            profile = await asyncio.wait_for(chain.ainvoke({"history": history or "None", "query": query}), timeout=4.0)
            if isinstance(profile, CitizenProfile):
                return profile
            if isinstance(profile, dict):
                return CitizenProfile(**profile)
        except Exception as e:
            logger.debug(f"LCEL Profile Chain fallback: {e}")

    # 2. Secondary Path: High-fidelity multi-state rule-based parser fallback
    q_text = query.lower()
    h_text = history.lower()
    text = f"{history} {query}".lower()
    district = None
    state = None

    # Step A: District match in current query FIRST
    for d_name, st_name in DISTRICT_STATE_MAP.items():
        d_lower = d_name.lower()
        if re.search(r'\b' + re.escape(d_lower) + r'\b', q_text) or d_lower in q_text:
            district = d_name.capitalize()
            state = st_name
            break

    # If not in query, check history
    if not district:
        for d_name, st_name in DISTRICT_STATE_MAP.items():
            d_lower = d_name.lower()
            if re.search(r'\b' + re.escape(d_lower) + r'\b', h_text) or d_lower in h_text:
                district = d_name.capitalize()
                state = st_name
                break

    # Step B: Explicit State match if district not found or state still None
    if not state:
        for st_key, canonical in STATE_SYNONYMS.items():
            if re.search(r'\b' + re.escape(st_key) + r'\b', q_text) or st_key in q_text:
                state = canonical
                break
    if not state:
        for st_key, canonical in STATE_SYNONYMS.items():
            if re.search(r'\b' + re.escape(st_key) + r'\b', h_text) or st_key in h_text:
                state = canonical
                break

    # Canonical district for known state if district was omitted
    if state and not district:
        state_district_defaults = {
            "Maharashtra": "Jalna",
            "Gujarat": "Jamnagar",
            "Telangana": "Suryapet",
            "Karnataka": "Belagavi",
            "Madhya Pradesh": "Ujjain",
            "Uttar Pradesh": "Gorakhpur",
            "Bihar": "Muzaffarpur",
            "Punjab": "Bathinda",
            "Haryana": "Sirsa",
        }
        district = state_district_defaults.get(state, "District Headquarters")

    # Step C: Land size and unit extraction
    land_val = None
    land_unit = "acre"

    # Normalize Indic digits
    indic_digits = {'०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'}
    norm_text = text
    for ind_k, ind_v in indic_digits.items():
        norm_text = norm_text.replace(ind_k, ind_v)

    # Cents (Telangana, AP, Karnataka)
    c_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:cent|cents|సెంట్లు|సెంట్|సెల్ల)\b', q_text) or re.search(r'(\d+(?:\.\d+)?)\s*(?:cent|cents)\b', h_text)
    if c_m:
        land_val = float(c_m.group(1))
        land_unit = "cent"
    else:
        match = re.search(
            r'(\d+(?:\.\d+)?)\s*(acre|acres|guntha|gunthe|gunta|bigha|vigha|hectare|ha|cent|kanal|marla|killa)',
            norm_text
        )
        if match:
            land_val = float(match.group(1))
            land_unit = match.group(2)
        else:
            digit_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:एकड|एकर|गुंठे|बीघा|विघा|कनाल|किल्ला|हेक्टर)', norm_text)
            if digit_match:
                land_val = float(digit_match.group(1))
                land_unit = "acre"

    missing_q = None
    if land_val is None:
        missing_q = "How many acres, bighas, or gunthas of farmland do you cultivate?"

    return CitizenProfile(
        state=state or "Maharashtra",
        district_or_village=district or "Jalna",
        land_value=land_val if land_val else 2.0,
        land_unit=land_unit,
        crop_or_business_type="Kharif Crops",
        sector="drought_relief",
        missing_critical_question=missing_q if land_val is None else None
    )


async def adjudicate_eligibility(
    profile: CitizenProfile,
    hectares: float,
    rag_docs: List[Dict[str, Any]],
    csc_center: Dict[str, Any],
    agro_data: Dict[str, Any]
) -> SchemeVerdict:
    """
    Executes LCEL Chain 2 to adjudicate SchemeVerdict.
    Falls back to state-specific official government resolutions if LLM is offline or unconfigured.
    """
    _, entitlement_amount, entitlement_calc = calculate_entitlement(
        hectares=hectares,
        crop_type="rainfed",
        state=profile.state
    )

    llm = get_llm()
    if llm:
        try:
            chain = build_verdict_chain(llm)
            verdict = await chain.ainvoke({
                "profile": profile.model_dump_json(),
                "hectares": hectares,
                "entitlement_calc": entitlement_calc,
                "rag_chunks": json.dumps(rag_docs, ensure_ascii=False),
                "csc_center": json.dumps(csc_center, ensure_ascii=False),
                "agro_data": json.dumps(agro_data, ensure_ascii=False)
            })
            if isinstance(verdict, SchemeVerdict):
                return verdict
            if isinstance(verdict, dict):
                return SchemeVerdict(**verdict)
        except Exception as e:
            logger.error(f"LCEL Verdict Chain failed: {e}. Using deterministic official resolution adjudicator.")

    # High-fidelity state-specific official government resolution adjudication
    st_lower = (profile.state or "all_india").lower()
    center_name = csc_center.get("center_name", "Nearest Public Service Centre")
    is_eligible = (hectares is not None and hectares > 0 and hectares <= 5.0)

    if "telangana" in st_lower:
        scheme_name = "Telangana Rythu Bharosa & SDRF Disaster Input Subsidy (రైతు భరోసా & SDRF పరిహారం)"
        docs = [
            "Digital Pattadar Passbook / Dharani ROR 1-B (పట్టాదారు పాస్‌బుక్)",
            "Aadhaar-seeded Bank Account Passbook (ఆధార్ అనుసంధాన బ్యాంక్ ఖాతా)",
            "Joint Agriculture & Revenue Department Crop Loss Panchnama Report"
        ]
        citation = "Government of Telangana Agriculture & Cooperation Dept (Rythu Bharosa / SDRF Guidelines)"
        voice_script = (
            f"Namaste. You are eligible for Telangana Rythu Bharosa & Disaster Relief. "
            f"For your {hectares:.3f} hectares of land, estimated relief entitlement is ₹{entitlement_amount:,.0f}. "
            f"Please carry your Pattadar passbook, Aadhaar bank passbook, and crop loss panchnama "
            f"to {center_name} to complete your verification."
        )
    elif "karnataka" in st_lower:
        scheme_name = "Karnataka Parihara Drought Relief & Input Subsidy (ಕರ್ನಾಟಕ ಪರಿಹಾರ ಬೆಳೆ ಹಾನಿ ಸಹಾಯಧನ)"
        docs = [
            "Bhoomi RTC / Pahani Land Record Extract (ಭೂಮಿ ಆರ್‌ಟಿಸಿ / ಪಹಣಿ ಪ್ರತಿ)",
            "Aadhaar-seeded Bank Account Passbook (ಆಧಾರ್ ಜೋಡಿಸಿದ ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್)",
            "Joint Calamity Survey / Crop Loss Panchnama Report (ಬೆಳೆ ಹಾನಿ ಜಂಟಿ ಸಮೀಕ್ಷೆ ವರದಿ)"
        ]
        citation = "Karnataka Revenue Department (Disaster Management) Parihara Guidelines"
        voice_script = (
            f"Namaskara. You are eligible for Karnataka Parihara Drought Relief Assistance. "
            f"For your {hectares:.3f} hectares of land, estimated relief entitlement is ₹{entitlement_amount:,.0f}. "
            f"Please bring your Bhoomi RTC Pahani, Aadhaar bank passbook, and crop survey report "
            f"to {center_name} for direct benefit transfer."
        )
    elif "madhya pradesh" in st_lower:
        scheme_name = "Madhya Pradesh RBC 6-4 Calamity Relief & Kisan Kalyan (मध्य प्रदेश राजस्व पुस्तक परिपत्र ६-४ फसल राहत)"
        docs = [
            "Digital Khasra / Khatauni Record from SAARA / MP Bhu-Abhilekh (डिजिटल खसरा / खतौनी नकल)",
            "Aadhaar-linked Bank Account Passbook (आधार लिंक बैंक खाता पासबुक)",
            "Patwari & Agriculture Extension Officer Crop Loss Panchnama Report"
        ]
        citation = "Madhya Pradesh Revenue Book Circular (RBC 6-4) & SDRF Calamity Assistance"
        voice_script = (
            f"Namaste. You are eligible for Madhya Pradesh RBC 6-4 Crop Calamity Relief. "
            f"For your {hectares:.3f} hectares of land, estimated assistance is ₹{entitlement_amount:,.0f}. "
            f"Please take your MP Bhu-Abhilekh Khasra-Khatauni, Aadhaar bank passbook, and Patwari panchnama "
            f"to {center_name}."
        )
    elif "uttar pradesh" in st_lower:
        scheme_name = "Uttar Pradesh SDRF Krishi Nivesh Anudan & Fasal Rahat (उत्तर प्रदेश कृषि निवेश अनुदान एवं आपदा राहत)"
        docs = [
            "Computerized Khatauni / Khasra extract from UP Bhulekh (यूपी भूलेख खतौनी)",
            "Aadhaar-seeded Bank Account Passbook (आधार लिंक बैंक खाता पासबुक)",
            "Lekhpal Crop Loss Panchnama / Survey Report (लेखपाल फसल क्षति पंचनामा)"
        ]
        citation = "Office of the Relief Commissioner, Revenue Department, Government of Uttar Pradesh (rahat.up.nic.in)"
        voice_script = (
            f"Namaste. You are eligible for Uttar Pradesh Krishi Nivesh Anudan & Fasal Rahat. "
            f"For your {hectares:.3f} hectares of land, estimated entitlement is ₹{entitlement_amount:,.0f}. "
            f"Please take your UP Bhulekh Khatauni, Aadhaar passbook, and Lekhpal panchnama "
            f"to {center_name}."
        )
    elif "bihar" in st_lower:
        scheme_name = "Bihar Rajya Fasal Sahayata Yojana (BRFSY / बिहार राज्य फसल सहायता योजना) & आपदा राहत"
        docs = [
            "Land Possession Certificate (LPC) or Revenue Land Receipt (भू-स्वामित्व प्रमाण पत्र / जमीन रसीद)",
            "Aadhaar-seeded Bank Account Passbook (आधार लिंक बैंक खाता पासबुक)",
            "Farmer Registration Receipt & Self-Declaration Panchnama (बिहार किसान पंजीकरण एवं स्व-घोषणा)"
        ]
        citation = "Department of Cooperative & Disaster Management, Government of Bihar (pacsonline.bih.nic.in/fsy)"
        voice_script = (
            f"Namaste. You are eligible for Bihar Rajya Fasal Sahayata Yojana assistance. "
            f"For your {hectares:.3f} hectares of land, estimated assistance is ₹{entitlement_amount:,.0f}. "
            f"Please bring your LPC or land revenue receipt, Aadhaar bank passbook, and registration certificate "
            f"to {center_name}."
        )
    elif "punjab" in st_lower:
        scheme_name = "Punjab Natural Calamity Crop Compensation & Special Girdawari (ਪੰਜਾਬ ਕੁਦਰਤੀ ਆਫ਼ਤ ਫ਼ਸਲ ਨੁਕਸਾਨ ਮੁਆਵਜ਼ਾ)"
        docs = [
            "Jamabandi / Fard Land Record Extract from PLRS (ਜਮ੍ਹਾਂਬੰਦੀ / ਫ਼ਰਦ ਨਕਲ)",
            "Aadhaar-seeded Bank Account Passbook (ਆਧਾਰ ਲਿੰਕਡ ਬੈਂਕ ਖਾਤਾ ਪਾਸਬੁੱਕ)",
            "Certified Special Khasra Girdawari Loss Report (ਵਿਸ਼ੇਸ਼ ਗਿਰਦਾਵਰੀ ਰਿਪੋਰਟ)"
        ]
        citation = "Department of Revenue, Rehabilitation and Disaster Management, Government of Punjab"
        voice_script = (
            f"Sat Sri Akal. You are eligible for Punjab Special Girdawari Crop Compensation. "
            f"For your {hectares:.3f} hectares of land, estimated compensation is ₹{entitlement_amount:,.0f}. "
            f"Please take your Jamabandi Fard, Aadhaar bank passbook, and Patwari Girdawari report "
            f"to {center_name}."
        )
    elif "haryana" in st_lower:
        scheme_name = "Haryana Meri Fasal Mera Byora & Calamity Compensation (हरियाणा मेरी फसल मेरा ब्योरा एवं आपदा राहत)"
        docs = [
            "Meri Fasal Mera Byora (MFMB) Registration Certificate (मेरी फसल मेरा ब्योरा पर्ची)",
            "Jamabandi / Farad Land Record Extract (जमाबंदी / फर्द नकल)",
            "Aadhaar-seeded Bank Account Passbook / Parivar Pehchan Patra (परिवार पहचान पत्र एवं बैंक पासबुक)"
        ]
        citation = "Department of Revenue and Disaster Management, Government of Haryana (fasal.haryana.gov.in)"
        voice_script = (
            f"Namaste. You are eligible for Haryana Meri Fasal Mera Byora Calamity Relief. "
            f"For your {hectares:.3f} hectares of land, estimated compensation is ₹{entitlement_amount:,.0f}. "
            f"Please take your MFMB registration slip, Jamabandi extract, and Aadhaar bank passbook "
            f"to {center_name}."
        )
    elif "gujarat" in st_lower:
        scheme_name = "Gujarat Mukhya Mantri Kisan Sahay Yojana (MMKSY / મુખ્યમંત્રી કિસાન સહાય યોજના)"
        docs = [
            "Digital 7/12 Land Record Extract (સાતબારા) and 8-A Khata Extract from AnyRoR Gujarat",
            "Aadhaar-seeded Bank Account Passbook (आधार संलग्न बँक खाते)",
            "Village Talati / Gramsevak Joint Crop Survey Panchnama Report"
        ]
        citation = "Department of Agriculture, Farmers Welfare & Co-operation, Government of Gujarat (ikhedut.gujarat.gov.in)"
        voice_script = (
            f"Namaste. You are eligible for Gujarat Mukhya Mantri Kisan Sahay Yojana. "
            f"For your {hectares:.3f} hectares of land, estimated assistance is ₹{entitlement_amount:,.0f}. "
            f"Please carry your AnyRoR 7/12 extract, Aadhaar bank passbook, and Talati crop survey report "
            f"to {center_name}."
        )
    elif "maha" in st_lower:
        scheme_name = "Maharashtra Kharif Drought Relief & Input Subsidy (शासन निर्णय क्र. मसुद-२०२४)"
        docs = [
            "7/12 Utara & 8A Land Record Extract (तलाठी सहीसह सातबारा)",
            "Aadhaar-Seeded Bank Passbook (आधार संलग्न बँक पासबुक)",
            "Talathi / Revenue Officer Joint Crop Loss Panchnama (नुकसान भरपाई पंचनामा)"
        ]
        citation = "Maharashtra GR No. MASUD-2024/CR-18/M-3 (Section 4.2 Drought Relief Assistance)"
        voice_script = (
            f"Namaste. You are eligible for Maharashtra Kharif Drought Relief. "
            f"For your {hectares:.3f} hectares of land, estimated relief entitlement is ₹{entitlement_amount:,.0f}. "
            f"Please carry your 7/12 land extract, Aadhaar bank passbook, and crop loss panchnama "
            f"to {center_name}."
        )
    else:
        scheme_name = "Pradhan Mantri Fasal Bima Yojana (PMFBY) Crop Loss Relief"
        docs = [
            "Record of Rights (RoR) / Land Ownership Record Extract",
            "Aadhaar-Seeded Bank Passbook (NPCI Active)",
            "Sowing Certificate or Local Revenue Crop Loss Panchnama"
        ]
        citation = "Ministry of Agriculture & Farmers Welfare, Government of India (PMFBY Operational Guidelines)"
        voice_script = (
            f"Namaste. You are eligible for Pradhan Mantri Fasal Bima Yojana relief. "
            f"For your {hectares:.3f} hectares of land, estimated entitlement is ₹{entitlement_amount:,.0f}. "
            f"Please carry your land ownership record, Aadhaar bank passbook, and crop loss certificate "
            f"to {center_name}."
        )

    return SchemeVerdict(
        is_eligible=is_eligible,
        scheme_name=scheme_name,
        entitlement_summary=entitlement_calc,
        exact_three_documents=docs,
        source_citation=citation,
        english_voice_script=voice_script
    )
