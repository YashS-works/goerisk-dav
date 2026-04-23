from dotenv import load_dotenv
load_dotenv()

# Shock type weights — how much each domain
# contributes to SI based on shock type
SHOCK_WEIGHTS = {
    "war": {
        "energy": 0.50,
        "trade":  0.30,
        "food":   0.20
    },
    "sanctions": {
        "energy": 0.35,
        "trade":  0.45,
        "food":   0.20
    },
    "supply": {
        "energy": 0.25,
        "trade":  0.35,
        "food":   0.40
    }
}

# Risk level thresholds
def get_risk_level(si: float) -> str:
    if si >= 0.75: return "critical"
    if si >= 0.50: return "high"
    if si >= 0.25: return "moderate"
    return "low"

def get_risk_color(si: float) -> str:
    if si >= 0.75: return "#dc2626"
    if si >= 0.50: return "#d97706"
    if si >= 0.25: return "#f97316"
    return "#16a34a"


def compute_si(
    country_code: str,
    wb_data:      dict,
    food_data:    dict,
    shock_type:   str  = "war",
    intensity:    float = 1.0
) -> dict:
    """
    Compute Spillover Index for a single country.

    Formula:
    SI = (energy_score * w_e) + (trade_score * w_t) + (food_score * w_f)

    Where each score is normalized 0-1 from real API data.
    Intensity scales the final result (0.1 to 1.0).
    """
    weights = SHOCK_WEIGHTS.get(shock_type, SHOCK_WEIGHTS["war"])

    # --- Get World Bank indicators ---
    wb = wb_data.get(country_code, {})
    energy_import_pct = wb.get("energy_import_pct", 0.0)
    food_import_pct   = wb.get("food_import_pct",   0.0)
    trade_gdp_pct     = wb.get("trade_gdp_pct",     0.0)

    # --- Get FAO food data if available ---
    fao = food_data.get(country_code, {})
    fao_food_pct = fao.get("food_import_pct", food_import_pct)

    # Use best available food data
    best_food_pct = max(food_import_pct, fao_food_pct)

    # --- Normalize each indicator to 0-1 ---
    # Energy: max realistic import dependency = 100%
    energy_score = min(1.0, energy_import_pct / 100.0)

    # Trade: max realistic trade/GDP = 200% (small open economies)
    trade_score  = min(1.0, trade_gdp_pct / 200.0)

    # Food: max realistic food import = 100%
    food_score   = min(1.0, best_food_pct / 100.0)

    # --- Apply shock weights ---
    weighted_si = (
        (energy_score * weights["energy"]) +
        (trade_score  * weights["trade"])  +
        (food_score   * weights["food"])
    )

    # --- Apply intensity scaling ---
    final_si = min(1.0, weighted_si * intensity)
    final_si = round(final_si, 3)

    # --- Individual domain SI ---
    energy_si = round(min(1.0, energy_score * intensity), 3)
    trade_si  = round(min(1.0, trade_score  * intensity), 3)
    food_si   = round(min(1.0, food_score   * intensity), 3)

    return {
        "country_code":  country_code,
        "energy_si":     energy_si,
        "trade_si":      trade_si,
        "food_si":       food_si,
        "composite_si":  final_si,
        "risk_level":    get_risk_level(final_si),
        "risk_color":    get_risk_color(final_si),
        "shock_type":    shock_type,
        "intensity":     intensity,
        "raw": {
            "energy_import_pct": energy_import_pct,
            "food_import_pct":   best_food_pct,
            "trade_gdp_pct":     trade_gdp_pct
        }
    }


def compute_all_countries_si(
    countries:  dict,
    wb_data:    dict,
    food_data:  dict,
    shock_type: str   = "war",
    intensity:  float = 1.0
) -> dict:
    """
    Computes SI for ALL countries at once.
    Returns dict keyed by country code.
    """
    results = {}

    for code in countries:
        try:
            si = compute_si(
                country_code = code,
                wb_data      = wb_data,
                food_data    = food_data,
                shock_type   = shock_type,
                intensity    = intensity
            )
            results[code] = si
        except Exception as e:
            results[code] = {
                "country_code": code,
                "energy_si":    0.0,
                "trade_si":     0.0,
                "food_si":      0.0,
                "composite_si": 0.0,
                "risk_level":   "unknown",
                "risk_color":   "#94a3b8",
                "shock_type":   shock_type,
                "intensity":    intensity
            }

    return results


def compute_bilateral_si(
    origin_code: str,
    target_code: str,
    wb_data:     dict,
    food_data:   dict,
    trade_data:  dict,
    shock_type:  str   = "war",
    intensity:   float = 1.0
) -> dict:
    """
    Computes SI between two specific countries.
    Takes into account bilateral trade dependency.
    Used when user clicks a country on the map.
    """
    # Base SI for target country
    base_si = compute_si(
        country_code = target_code,
        wb_data      = wb_data,
        food_data    = food_data,
        shock_type   = shock_type,
        intensity    = intensity
    )

    # Check bilateral trade dependency
    origin_trade = trade_data.get(origin_code, {})
    exports      = origin_trade.get("exports", {})
    total_export = origin_trade.get("total_export", 0)

    # Find how much target depends on origin
    trade_dependency = 0.0
    if total_export > 0:
        for partner, value in exports.items():
            if target_code.lower() in partner.lower():
                trade_dependency = value / total_export
                break

    # Boost SI if high bilateral dependency
    boosted_si = min(1.0, base_si["composite_si"] + (trade_dependency * 0.3))

    return {
        **base_si,
        "composite_si":      round(boosted_si, 3),
        "risk_level":        get_risk_level(boosted_si),
        "risk_color":        get_risk_color(boosted_si),
        "trade_dependency":  round(trade_dependency, 4),
        "bilateral_boost":   round(trade_dependency * 0.3, 4)
    }


def rank_countries_by_si(si_scores: dict) -> list:
    """
    Returns countries sorted by composite SI descending.
    """
    ranked = []
    for code, scores in si_scores.items():
        ranked.append({
            "rank":         0,
            "country_code": code,
            "composite_si": scores.get("composite_si", 0),
            "energy_si":    scores.get("energy_si",    0),
            "trade_si":     scores.get("trade_si",     0),
            "food_si":      scores.get("food_si",      0),
            "risk_level":   scores.get("risk_level",   "unknown"),
            "risk_color":   scores.get("risk_color",   "#94a3b8")
        })

    ranked.sort(key=lambda x: x["composite_si"], reverse=True)

    for i, item in enumerate(ranked):
        item["rank"] = i + 1

    return ranked