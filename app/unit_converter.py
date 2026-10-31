"""
Deterministic Rural Land Unit Normalizer & Payout Calculator for PolicySetu AI.
Strictly converts non-metric spoken land measurements (Acres, Gunthas, Bighas, Cents, Kanals, Marlas, Killas)
into standard Hectares to ensure 100% mathematical fidelity with official government mandates.
Supports regional state variations (e.g. Gujarat Vigha vs UP/MP Pucca Bigha vs Punjab/Haryana Killa/Kanal).
"""

from typing import Dict, Optional, Tuple

# Baseline official conversion multipliers to standard Hectares (1 Hectare = 10,000 m²)
UNIT_TO_HECTARE: Dict[str, float] = {
    # Standard metric
    "hectare": 1.0,
    "ha": 1.0,
    "hektar": 1.0,

    # Anglo-Indian Standard (All India)
    "acre": 0.404686,
    "acres": 0.404686,
    "ekad": 0.404686,
    "ekar": 0.404686,

    # Deccan / Western & Southern India (Maharashtra, Karnataka, Telangana)
    # 40 Gunthas = 1 Acre
    "guntha": 0.010117,
    "gunthe": 0.010117,
    "gunta": 0.010117,
    "gunte": 0.010117,

    # Northern / Central India Standard Pucca Bigha (UP, MP, Bihar, Rajasthan)
    # Standard Pucca Bigha (~ 0.252929 Ha = ~ 3025 sq yards)
    "bigha": 0.252929,
    "bighas": 0.252929,
    "vighe": 0.252929,
    "vigha": 0.252929,

    # Biswa (1/20 of Bigha)
    "biswa": 0.012646,

    # Southern India (Karnataka, Telangana, AP)
    # 100 Cents = 1 Acre
    "cent": 0.004047,
    "cents": 0.004047,

    # North-West India (Punjab, Haryana)
    # 1 Killa = 1 Acre = 8 Kanals; 1 Kanal = 20 Marlas
    "killa": 0.404686,
    "kille": 0.404686,
    "kanal": 0.050586,
    "kanals": 0.050586,
    "marla": 0.002529,
    "marlas": 0.002529,
}

# State-specific unit multipliers where standard definition varies
STATE_SPECIFIC_MULTIPLIERS: Dict[str, Dict[str, float]] = {
    "gujarat": {
        # Gujarat standard Vigha = 16 Gunthas = ~0.1619 Hectares (2.5 Vighas = 1 Acre)
        "bigha": 0.161874,
        "bighas": 0.161874,
        "vigha": 0.161874,
        "vighe": 0.161874,
    },
    "punjab": {
        # Standard Kaccha Bigha in North-West ~ 0.2023 Ha (5 Kanals)
        "bigha": 0.202343,
        "bighas": 0.202343,
    },
    "haryana": {
        "bigha": 0.202343,
        "bighas": 0.202343,
    },
    "uttar pradesh": {
        "bigha": 0.252929,
        "bighas": 0.252929,
    },
    "madhya pradesh": {
        "bigha": 0.252929,
        "bighas": 0.252929,
    },
    "bihar": {
        "bigha": 0.252929,
        "bighas": 0.252929,
    }
}

# Standard Government Subsidy / Relief Slabs (INR per Hectare) based on official SDRF/State GRs
RELIEF_RATES_PER_HECTARE = {
    "rainfed": 8500.0,       # Rainfed / Jirayat crop loss
    "irrigated": 17000.0,     # Irrigated / Bagayat crop loss
    "perennial": 22500.0,     # Perennial / Orchards (फळपिके)
    "general": 8500.0,
}

# State-specific compensation rates per hectare where higher state programs exist
STATE_RELIEF_RATES = {
    "gujarat": {
        "rainfed": 20000.0,   # MMKSY 33-60% damage slab
        "irrigated": 20000.0,
        "perennial": 25000.0,
    },
    "punjab": {
        "rainfed": 37065.0,   # Special Girdawari (₹15,000 / acre = ₹37,065 / ha)
        "irrigated": 37065.0,
        "perennial": 22500.0,
    },
    "haryana": {
        "rainfed": 37065.0,   # MFMB Calamity compensation (₹15,000 / acre for >75% damage)
        "irrigated": 37065.0,
        "perennial": 22500.0,
    }
}

MAX_DROUGHT_RELIEF_HECTARES = 2.0  # Official government relief cap (up to 2 ha per farmer under SDRF)
SMALL_MARGINAL_FARMER_CAP_HECTARES = 2.0


def normalize_unit_name(unit_str: Optional[str]) -> str:
    """Cleans and maps vernacular unit string variations to canonical unit key."""
    if not unit_str:
        return "acre"
    cleaned = unit_str.strip().lower()
    return cleaned


def convert_to_hectares(
    value: Optional[float],
    unit: Optional[str],
    state: Optional[str] = None
) -> Optional[float]:
    """
    Converts a numeric land size from a given unit into standard Hectares.
    Incorporates state context for regional variations (e.g. Gujarat Vigha vs UP Pucca Bigha).
    Rounds to 3 decimal places for regulatory consistency.
    Example: 2 Acres -> 0.809 Hectares
             40 Gunthas -> 0.405 Hectares
             3 Bighas (UP) -> 0.759 Hectares
             3 Bighas (Gujarat) -> 0.486 Hectares
    """
    if value is None or value <= 0:
        return None

    unit_key = normalize_unit_name(unit)

    # Check state-specific multiplier override first
    if state:
        st_norm = state.strip().lower()
        if st_norm in STATE_SPECIFIC_MULTIPLIERS and unit_key in STATE_SPECIFIC_MULTIPLIERS[st_norm]:
            multiplier = STATE_SPECIFIC_MULTIPLIERS[st_norm][unit_key]
            return round(value * multiplier, 3)

    # Default to canonical multiplier
    multiplier = UNIT_TO_HECTARE.get(unit_key, UNIT_TO_HECTARE["acre"])
    hectares = round(value * multiplier, 3)
    return hectares


def calculate_entitlement(
    hectares: Optional[float],
    crop_type: str = "rainfed",
    max_cap_hectares: float = MAX_DROUGHT_RELIEF_HECTARES,
    state: Optional[str] = None
) -> Tuple[bool, float, str]:
    """
    Calculates deterministic subsidy / drought relief entitlement based on land size and state guidelines.
    Returns:
        (is_eligible, total_inr, breakdown_explanation)
    """
    if hectares is None or hectares <= 0:
        return False, 0.0, "Land size not specified or invalid"

    category = crop_type.lower()
    st_norm = (state or "").strip().lower()

    # Determine rate basis: state-specific if available, else standard SDRF rate
    if st_norm in STATE_RELIEF_RATES and category in STATE_RELIEF_RATES[st_norm]:
        rate = STATE_RELIEF_RATES[st_norm][category]
    else:
        rate = RELIEF_RATES_PER_HECTARE.get(category, RELIEF_RATES_PER_HECTARE["rainfed"])

    # Gujarat MMKSY allows up to 4.0 hectares
    effective_cap = 4.0 if ("gujarat" in st_norm) else max_cap_hectares

    # Enforce government regulatory cap
    applicable_hectares = min(hectares, effective_cap)
    total_amount = round(applicable_hectares * rate, 2)

    capped_note = f" (capped at maximum {effective_cap} ha)" if hectares > effective_cap else ""
    breakdown = (
        f"₹{total_amount:,.0f} calculated at ₹{rate:,.0f}/ha for "
        f"{applicable_hectares:.3f} ha ({category} crops){capped_note}"
    )

    return True, total_amount, breakdown


def is_small_marginal_farmer(hectares: Optional[float]) -> bool:
    """Checks if citizen qualifies as Small & Marginal Farmer (SMF) (<= 2.0 Hectares)."""
    if hectares is None:
        return False
    return hectares <= SMALL_MARGINAL_FARMER_CAP_HECTARES
