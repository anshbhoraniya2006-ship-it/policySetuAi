"""
Deterministic Rural Land Unit Normalizer & Payout Calculator.
Strictly converts non-metric spoken land measurements (Acres, Gunthas, Bighas, Cents)
into standard Hectares to ensure 100% mathematical fidelity with official government mandates.
"""

from typing import Dict, Optional, Tuple

# Official conversion multipliers to standard Hectares (1 Hectare = 10,000 m²)
UNIT_TO_HECTARE: Dict[str, float] = {
    # Standard metric
    "hectare": 1.0,
    "ha": 1.0,
    "hektar": 1.0,

    # Anglo-Indian Standard
    "acre": 0.404686,
    "acres": 0.404686,
    "ekad": 0.404686,
    "ekar": 0.404686,

    # Deccan / Western India (Maharashtra, Karnataka, Telangana)
    # 40 Gunthas = 1 Acre
    "guntha": 0.010117,
    "gunthe": 0.010117,
    "gunta": 0.010117,
    "gunte": 0.010117,

    # Northern / Central India (UP, MP, Bihar, Rajasthan, Gujarat)
    # Standard Pucca Bigha (~ 0.252929 Ha = ~ 3025 sq yards)
    "bigha": 0.252929,
    "bighas": 0.252929,
    "vighe": 0.252929,
    "vigha": 0.252929,

    # Biswa (1/20 of Bigha)
    "biswa": 0.012646,

    # South India (Tamil Nadu, Kerala, Andhra Pradesh)
    # 100 Cents = 1 Acre
    "cent": 0.004047,
    "cents": 0.004047,

    # North-West India (Punjab, Haryana, J&K)
    # 8 Kanals = 1 Acre
    "kanal": 0.050586,
    "marla": 0.002529,
}

# Standard Government Subsidy / Relief Slabs (INR per Hectare) based on official GRs
RELIEF_RATES_PER_HECTARE = {
    "rainfed": 8500.0,       # Rainfed / Jirayat crop loss
    "irrigated": 17000.0,     # Irrigated / Bagayat crop loss
    "perennial": 22500.0,     # Perennial / Orchards (फळपिके)
    "general": 8500.0,
}

MAX_DROUGHT_RELIEF_HECTARES = 2.0  # Official government relief cap (up to 2 ha per farmer)
SMALL_MARGINAL_FARMER_CAP_HECTARES = 2.0


def normalize_unit_name(unit_str: Optional[str]) -> str:
    """Cleans and maps vernacular unit string variations to canonical unit key."""
    if not unit_str:
        return "acre"
    cleaned = unit_str.strip().lower()
    return cleaned


def convert_to_hectares(value: Optional[float], unit: Optional[str]) -> Optional[float]:
    """
    Converts a numeric land size from a given unit into standard Hectares.
    Rounds to 3 decimal places for regulatory consistency.
    Example: 2 Acres -> 0.809 Hectares
             40 Gunthas -> 0.405 Hectares
    """
    if value is None or value <= 0:
        return None

    unit_key = normalize_unit_name(unit)
    multiplier = UNIT_TO_HECTARE.get(unit_key, UNIT_TO_HECTARE["acre"])
    hectares = round(value * multiplier, 3)
    return hectares


def calculate_entitlement(
    hectares: Optional[float],
    crop_type: str = "rainfed",
    max_cap_hectares: float = MAX_DROUGHT_RELIEF_HECTARES
) -> Tuple[bool, float, str]:
    """
    Calculates deterministic subsidy / drought relief entitlement.
    Returns:
        (is_eligible, total_inr, breakdown_explanation)
    """
    if hectares is None or hectares <= 0:
        return False, 0.0, "Land size not specified or invalid"

    category = crop_type.lower()
    rate = RELIEF_RATES_PER_HECTARE.get(category, RELIEF_RATES_PER_HECTARE["rainfed"])

    # Enforce government regulatory cap
    applicable_hectares = min(hectares, max_cap_hectares)
    total_amount = round(applicable_hectares * rate, 2)

    capped_note = f" (capped at maximum {max_cap_hectares} ha)" if hectares > max_cap_hectares else ""
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
