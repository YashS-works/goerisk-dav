"""
Deterministic geopolitical relevance ranking filter.

Runs before AI enrichment on every simulation so rankings reflect
geopolitical reality even when AI keys are absent or calls fail.

Scoring priority (for war type):
  1. Direct conflict participants        → 3.0x
  2. Countries bordering BOTH parties   → 2.5x  (e.g. Mongolia in RUS-CHN)
  3. Countries bordering ONE party      → 2.0x
  4. High bilateral trade dependency    → 1.3–2.5x
  5. Moderate bilateral trade / region  → 1.1–1.5x
  6. Small structurally-open economies  → 0.25x  (no conflict linkage)
  7. Default                            → 1.0x

"Small structurally-open economies" are countries where a high trade/GDP
ratio reflects re-export, financial-centre, or tourism activity rather than
genuine exposure to the specific conflict.  Malta, Luxembourg, Singapore etc.
should not dominate rankings for a Russia-China or India-Russia conflict.
"""

from __future__ import annotations
from services.si_calculator import get_risk_level, get_risk_color

# ── Countries whose high trade/GDP is structural, not conflict-linked ─────────
# Applied only when the country also has no meaningful bilateral trade with,
# no border connection to, and is not in the same region as either conflict party.
SMALL_OPEN_ECONOMIES: frozenset[str] = frozenset({
    # European micro/small states
    "MLT", "LUX", "IRL", "ISL", "CYP", "LIE", "MCO", "SMR", "AND",
    # Asian city-states / SARs
    "SGP", "HKG", "MAC",
    # Small island / enclave states
    "BHR", "MUS", "MDV", "CPV",
    # Other structurally-open small economies
    "ATG", "BRB", "GRD", "KNA", "LCA", "VCT", "BLZ", "FJI",
})

# Population and trade/GDP thresholds for heuristic detection
_SMALL_POP      = 4_000_000
_HIGH_TRADE_GDP = 90.0          # trade/GDP % above which we consider "structurally open"

# Bilateral trade share thresholds (fraction of a party's total exports)
_TRADE_HIGH     = 0.08          # ≥8 % → strong bilateral dependency
_TRADE_MODERATE = 0.03          # ≥3 % → moderate dependency


def _pair_key(origin_a: str, origin_b: str) -> frozenset[str]:
    return frozenset({origin_a, origin_b})


# Conflict-specific geopolitical priors. These are used only by the ranking
# layer and do not alter SI formulas, cascade logic, or external API data.
WAR_STRATEGIC_UPLIFTS: dict[frozenset[str], dict[str, float]] = {
    _pair_key("IND", "CHN"): {
        "IND": 3.0, "CHN": 3.0,
        "NPL": 2.5, "BTN": 2.5, "PAK": 2.5, "MMR": 2.5, "BGD": 2.5,
        "JPN": 2.0, "KOR": 2.0, "TWN": 2.0, "SGP": 2.0, "VNM": 2.0,
        "MYS": 2.0, "THA": 2.0,
        "LKA": 1.5, "IDN": 1.5, "PHL": 1.5,
    },
    _pair_key("RUS", "CHN"): {
        "RUS": 3.0, "CHN": 3.0,
        "MNG": 2.5, "KAZ": 2.5,
        "BLR": 2.0, "JPN": 2.0, "KOR": 2.0, "PRK": 2.0,
        "KGZ": 1.5, "UZB": 1.5,
    },
    _pair_key("USA", "IRN"): {
        "USA": 3.0, "IRN": 3.0,
        "IRQ": 2.5, "ARE": 2.5, "SAU": 2.5, "KWT": 2.5, "QAT": 2.5,
        "OMN": 2.5, "BHR": 2.5,
        "IND": 2.0, "CHN": 2.0, "JPN": 2.0, "KOR": 2.0,
        "PAK": 1.5, "TUR": 1.5,
    },
}


WAR_DISTANT_PENALTIES: dict[frozenset[str], set[str]] = {
    _pair_key("IND", "CHN"): {
        "EST", "LVA", "LTU", "MDA", "MLT", "LUX", "IRL", "ISL", "CYP",
    },
    _pair_key("RUS", "CHN"): {
        "MLT", "LUX", "IRL", "ISL", "CYP", "EST", "LVA", "LTU",
    },
    _pair_key("USA", "IRN"): {
        "MLT", "LUX", "IRL", "ISL", "CYP", "EST", "LVA", "LTU",
    },
}


# ── Trade-dependency helper ───────────────────────────────────────────────────

def _bilateral_trade_dep(
    country_code:  str,
    origin_a:      str,
    origin_b:      str,
    all_countries: dict,
    trade_data:    dict,
) -> float:
    """
    Returns max(bilateral trade share) between country_code and either
    conflict party, in range [0.0, 1.0].

    Checks both directions:
      • How much of origin_X's exports go to this country?
      • How much of this country's exports go to origin_X?
    """
    country_name = all_countries.get(country_code, {}).get("name", "").lower()
    max_dep = 0.0

    # Direction 1 — origin exports TO this country
    for origin in (origin_a, origin_b):
        o_trade = trade_data.get(origin, {})
        exports = o_trade.get("exports", {})
        total   = o_trade.get("total_export", 0) or 0
        if total <= 0:
            continue
        for partner, value in exports.items():
            pl = partner.lower()
            if (country_code.lower() in pl
                    or (country_name and (country_name in pl or pl in country_name))):
                dep = float(value or 0) / total
                max_dep = max(max_dep, dep)
                break

    # Direction 2 — this country exports TO origin
    c_trade = trade_data.get(country_code, {})
    c_exp   = c_trade.get("exports", {})
    c_total = c_trade.get("total_export", 0) or 0
    if c_total > 0:
        for origin in (origin_a, origin_b):
            o_name = all_countries.get(origin, {}).get("name", "").lower()
            for partner, value in c_exp.items():
                pl = partner.lower()
                if (origin.lower() in pl
                        or (o_name and (o_name in pl or pl in o_name))):
                    dep = float(value or 0) / c_total
                    max_dep = max(max_dep, dep)
                    break

    return min(1.0, max_dep)


# ── Core multiplier computation ───────────────────────────────────────────────

def compute_geo_weight(
    country_code:  str,
    origin_a:      str,
    origin_b:      str,
    all_countries: dict,
    trade_data:    dict,
    wb_data:       dict,
    shock_type:    str = "war",
) -> float:
    """
    Returns a geo_weight multiplier in [0.25, 3.0] for this country
    relative to the given conflict pair.

    Does NOT call any external API — uses only cached border, trade,
    and World Bank data already present at startup.
    """
    # 1. Direct conflict party
    if country_code in (origin_a, origin_b):
        return 3.0

    c_data     = all_countries.get(country_code, {})
    pop        = c_data.get("population", 100_000_000)
    region     = c_data.get("region",    "")
    subregion  = c_data.get("subregion", "")

    wb        = wb_data.get(country_code, {})
    trade_gdp = wb.get("trade_gdp_pct", 0) or 0

    # 2. Border proximity
    borders_a   = set(all_countries.get(origin_a, {}).get("borders", []))
    borders_b   = set(all_countries.get(origin_b, {}).get("borders", []))
    is_border_a = country_code in borders_a
    is_border_b = country_code in borders_b

    # 3. Bilateral trade
    trade_dep = _bilateral_trade_dep(
        country_code, origin_a, origin_b, all_countries, trade_data
    )
    pair = _pair_key(origin_a, origin_b)
    is_war = (shock_type or "war").lower() == "war"

    # 4. Regional alignment — use subregion for penalty decisions (finer grain),
    #    broad region for bonus decisions (captures regional powers)
    region_a    = all_countries.get(origin_a, {}).get("region",    "")
    region_b    = all_countries.get(origin_b, {}).get("region",    "")
    subregion_a = all_countries.get(origin_a, {}).get("subregion", "")
    subregion_b = all_countries.get(origin_b, {}).get("subregion", "")

    # Same *subregion* as a conflict party — meaningful proximity signal.
    # E.g. Poland (Eastern Europe) matches Russia (Eastern Europe) ✓
    #      Malta (Southern Europe) does NOT match Russia (Eastern Europe) ✗
    in_subregion = bool(subregion) and (
        subregion == subregion_a or subregion == subregion_b
    )
    # Broad region — used only for mild bonus (never used for penalty decisions)
    in_region = bool(region) and (region == region_a or region == region_b)

    # 5. Small structurally-open economy flag
    is_small_open = (
        country_code in SMALL_OPEN_ECONOMIES
        or (0 < pop < _SMALL_POP and trade_gdp > _HIGH_TRADE_GDP)
    )

    # ── Priority decision tree ────────────────────────────────────────────────

    if is_war:
        uplift = WAR_STRATEGIC_UPLIFTS.get(pair, {}).get(country_code)
        if uplift:
            return uplift

        if (
            country_code in WAR_DISTANT_PENALTIES.get(pair, set())
            and not is_border_a
            and not is_border_b
            and trade_dep < _TRADE_MODERATE
        ):
            return 0.25

    # Borders BOTH parties (e.g. Mongolia/Kazakhstan in Russia-China)
    if is_border_a and is_border_b:
        return min(3.0, 2.5 + trade_dep * 2.0)

    # Borders ONE party
    if is_border_a or is_border_b:
        return min(3.0, 2.0 + trade_dep * 1.5)

    # Strong bilateral trade dependency
    if trade_dep >= _TRADE_HIGH:
        return min(2.5, 1.3 + trade_dep * 3.0)

    # Moderate trade AND/OR same subregion
    if trade_dep >= _TRADE_MODERATE:
        bonus = 0.2 if in_subregion else 0.0
        return min(2.0, 1.1 + trade_dep * 2.5 + bonus)

    # Small open economy with no geopolitical link:
    #  - not bordering either party
    #  - not in the same subregion as either party  (subregion, not broad region)
    #  - no meaningful bilateral trade
    # → demote strongly so trade/GDP openness doesn't dominate rankings
    if is_small_open and not in_subregion and trade_dep < _TRADE_MODERATE:
        return 0.25

    # Same broad region, low trade — mild relevance
    if in_region:
        return min(1.3, 1.0 + trade_dep * 2.0)

    # No meaningful link — leave unchanged
    return 1.0


# ── Apply helpers ─────────────────────────────────────────────────────────────

def _scale_impact(impact: dict, weight: float) -> dict:
    """Apply weight to all SI fields, recalculate risk band."""
    if abs(weight - 1.0) < 0.005:
        return impact
    cap = 1.0
    new_si   = round(min(cap, (impact.get("composite_si",      0) or 0) * weight), 3)
    new_en   = round(min(cap, (impact.get("energy_si",         0) or 0) * weight), 3)
    new_tr   = round(min(cap, (impact.get("trade_si",          0) or 0) * weight), 3)
    new_fo   = round(min(cap, (impact.get("food_si",           0) or 0) * weight), 3)
    new_base = round(min(cap, (impact.get("base_composite_si", 0) or 0) * weight), 3)

    if weight >= 3.0:
        new_si = max(new_si, 0.90)
        new_base = max(new_base, 0.90)
    elif weight >= 2.5:
        new_si = max(new_si, 0.65)
        new_base = max(new_base, 0.65)
    elif weight >= 2.0:
        new_si = max(new_si, 0.50)
        new_base = max(new_base, 0.50)
    elif weight >= 1.5:
        new_si = max(new_si, 0.35)
        new_base = max(new_base, 0.35)
    elif weight <= 0.25:
        new_si = min(new_si, 0.12)
        new_base = min(new_base, 0.12)
    elif weight <= 0.5:
        new_si = min(new_si, 0.20)
        new_base = min(new_base, 0.20)

    return {
        **impact,
        "composite_si":      new_si,
        "energy_si":         new_en,
        "trade_si":          new_tr,
        "food_si":           new_fo,
        "base_composite_si": new_base,
        "risk_level":        get_risk_level(new_si),
        "risk_color":        get_risk_color(new_si),
    }


def apply_geo_ranking(
    country_impacts: list,
    origin_a:        str,
    origin_b:        str,
    all_countries:   dict,
    trade_data:      dict,
    wb_data:         dict,
    shock_type:      str = "war",
) -> list:
    """
    Apply deterministic geo_weight to country_impacts list.

    Skips countries where the AI already applied a meaningful downward
    correction (composite_si < base_composite_si * 0.9), preserving
    the AI's more-informed assessment for those entries.
    """
    result = []
    pair = _pair_key(origin_a, origin_b)
    is_war = (shock_type or "war").lower() == "war"
    strategic_codes = WAR_STRATEGIC_UPLIFTS.get(pair, {}) if is_war else {}
    for impact in country_impacts:
        code        = impact.get("country_code", "")
        current_si  = impact.get("composite_si",      0) or 0
        base_si     = impact.get("base_composite_si", current_si) or current_si

        # AI already meaningfully demoted this country — don't stack
        ai_demoted  = base_si > 0 and current_si < base_si * 0.90

        if ai_demoted and code not in strategic_codes:
            result.append(impact)
            continue

        weight = compute_geo_weight(
            code, origin_a, origin_b, all_countries, trade_data, wb_data, shock_type
        )
        result.append(_scale_impact(impact, weight))

    return result


def apply_geo_ranking_to_si_dict(
    global_si:     dict,
    origin_a:      str,
    origin_b:      str,
    all_countries: dict,
    trade_data:    dict,
    wb_data:       dict,
    shock_type:    str = "war",
) -> dict:
    """
    Apply deterministic geo_weight to the global SI dict (used for map heatmap).
    Applies unconditionally — the dict contains raw mathematical values.
    """
    corrected = {}
    for code, scores in global_si.items():
        weight = compute_geo_weight(
            code, origin_a, origin_b, all_countries, trade_data, wb_data, shock_type
        )
        corrected[code] = _scale_impact(scores, weight)
    return corrected
