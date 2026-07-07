"""
Geopolitical relevance adjustment layer.

Purpose
-------
Pure mathematical SI scores (World Bank energy%, trade/GDP%, food%) produce
unrealistic rankings. Small highly-open economies (Malta, Luxembourg, Ireland,
Singapore) rank above Mongolia or Kazakhstan in a Russia-China conflict because
the SI formula rewards trade-to-GDP percentage regardless of whether that
openness has any connection to the conflict.

This module calls Mistral once per simulation to assign a geo_multiplier
(0.25 – 3.0) for each assessed country. The multiplier is applied directly to
the existing composite_si, energy_si, trade_si, food_si, and base_composite_si
fields. risk_level, risk_color, affected_sectors, and household_impact are
updated in place.

The assessment set is: top-40 by current SI  UNION  direct border countries
of both conflict parties — guaranteeing that Mongolia, Kazakhstan, Belarus etc.
are always evaluated even when their mathematical SI is low.

No new fields are added to the response. No existing fields are removed.
The cascade engine, SI calculator, and scenario impact engine are untouched.
"""

import os
import json
import httpx
from dotenv import load_dotenv
from services.si_calculator import get_risk_level, get_risk_color

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_KEY") or os.getenv("MISTRAL_API_KEY", "")

_GEO_TOP_N = 20   # top countries by current SI — border countries added on top

# ── Shared reasoning instruction used across all Mistral calls ──────────────
GEO_REASONING_INSTRUCTION = """\
You are an expert geopolitical intelligence analyst.

Use supplied API data as factual evidence.
Use geopolitical knowledge to evaluate strategic importance.

Do NOT rank countries solely based on trade-to-GDP ratios or economic openness.
A small economy that is highly open to global trade is NOT necessarily exposed \
to a specific bilateral conflict.

Consider ALL of the following when assessing exposure:
  • Geographic proximity — shared land borders, distance from conflict zone
  • Military relevance — alliances, treaty obligations, arms flows, base access
  • Alliance relationships — NATO, CSTO, SCO, GCC, Arab League, AUKUS, Quad
  • Trade corridor importance — Silk Road/BRI, Trans-Siberian rail, CPEC, \
Gulf shipping, Suez, Strait of Hormuz, Malacca, Black Sea, Indian Ocean
  • Energy corridor importance — Russian pipeline gas, Central Asian oil, \
Middle East LNG, arctic routes, trans-Pacific LNG
  • Supply-chain dependencies — semiconductors, rare earths, steel, grain, \
fertilizer, pharmaceuticals, electronics
  • Conflict proximity — neighboring states, refugee pressure, proxy dynamics
  • Regional influence — regional powers that shape the conflict's trajectory

A country with LOWER economic exposure but MUCH HIGHER geopolitical relevance \
must rank ABOVE a country with higher economic exposure but little real \
connection to this specific conflict.\
"""

# ── Scale guide with arithmetic examples ────────────────────────────────────
_SCALE_GUIDE = """\
GEO_MULTIPLIER SCALE — formula: final_si = composite_si × geo_multiplier (capped at 1.0)

ARITHMETIC EXAMPLES so you understand how to calibrate:
  Mongolia in Russia-China conflict:
    current SI = 0.20 × geo_multiplier 2.8 = final_si 0.56  (HIGH risk — correct)
  Malta in Russia-China conflict:
    current SI = 0.45 × geo_multiplier 0.25 = final_si 0.11 (LOW risk — correct)
  Kazakhstan in Russia-China conflict:
    current SI = 0.28 × geo_multiplier 2.5 = final_si 0.70  (HIGH risk — correct)
  Japan in Russia-China conflict:
    current SI = 0.35 × geo_multiplier 1.8 = final_si 0.63  (HIGH risk — correct)
  Ireland in Russia-China conflict:
    current SI = 0.42 × geo_multiplier 0.30 = final_si 0.13 (LOW risk — correct)

BAND GUIDE:
  3.00 — Direct conflict participant (origin country)
  2.50–2.99 — Shares border with both parties OR extreme strategic dependence
              (e.g. Mongolia, North Korea in Russia-China)
  2.00–2.49 — Major regional power, strong alliance or energy corridor exposure
              (e.g. Kazakhstan, Belarus, Japan, South Korea in Russia-China)
  1.50–1.99 — Significant indirect exposure: adjacent region, key supply chain,
              important energy partner (e.g. Germany in Russia-Ukraine)
  1.10–1.49 — Moderate geopolitical relevance beyond what math captured
  1.00       — Mathematical score is already accurate — omit from output
  0.70–0.99 — Slightly overweighted by math
  0.40–0.69 — Materially overweighted — high trade/GDP but limited conflict link
  0.25–0.39 — Strongly overweighted — small open economy with no meaningful \
              connection to this conflict (Malta, Luxembourg, Ireland, \
              Singapore, Iceland, Cyprus in most non-European conflicts)\
"""

# ── Conflict-type lens ───────────────────────────────────────────────────────
_CONFLICT_LENS = {
    "war": (
        "Prioritise: shared borders, alliance treaty triggers, energy supply "
        "disruption, refugee and displacement pressure, naval chokepoint "
        "exposure, arms-supply-chain disruption, and food-export-ban cascade."
    ),
    "sanctions": (
        "Prioritise: secondary-sanction exposure, SWIFT/payment-system "
        "dependence, energy rerouting capacity, third-country evasion route "
        "exposure (India, China, Turkey, UAE as typical swing actors), and "
        "long-run technology decoupling risk."
    ),
    "supply": (
        "Prioritise: just-in-time manufacturing exposure, chokepoint proximity, "
        "commodity stockpile depth, alternative sourcing lead times, freight and "
        "insurance cost spike exposure, and food/energy import reliance."
    ),
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _compact_row(impact: dict, wb_data: dict, trade_data: dict) -> str:
    code      = impact.get("country_code", "")
    name      = impact.get("name", code)
    wb        = wb_data.get(code, {})
    en_pct    = wb.get("energy_import_pct", 0) or 0
    fo_pct    = wb.get("food_import_pct",   0) or 0
    tr_pct    = wb.get("trade_gdp_pct",     0) or 0
    exports   = trade_data.get(code, {}).get("exports", {})
    top_ptnrs = [k for k, _ in sorted(exports.items(), key=lambda x: x[1], reverse=True)[:3]]
    ptnr_str  = ", ".join(top_ptnrs) if top_ptnrs else "unknown"

    return (
        f"  {code} ({name}): SI={impact.get('composite_si', 0):.3f} "
        f"[E={impact.get('energy_si', 0):.3f} T={impact.get('trade_si', 0):.3f} "
        f"F={impact.get('food_si', 0):.3f}] "
        f"energy_import={en_pct:.1f}% food_import={fo_pct:.1f}% "
        f"trade/GDP={tr_pct:.1f}% top_partners=[{ptnr_str}]"
    )


def _get_geo_assessment_countries(
    country_impacts: list,
    origin_a:        str,
    origin_b:        str,
    all_countries:   dict,
    top_n:           int = _GEO_TOP_N,
) -> list:
    """
    Returns the union of:
    - Top-N countries by current composite_si
    - Direct border countries of both conflict parties
    This guarantees geopolitically critical but data-sparse countries
    (e.g. Mongolia in Russia-China) are always included in the assessment.
    """
    sorted_impacts  = sorted(
        country_impacts,
        key=lambda x: x.get("composite_si", 0),
        reverse=True
    )
    top      = sorted_impacts[:top_n]
    top_codes = {i["country_code"] for i in top}

    # Borders of both conflict parties
    borders_a = set(all_countries.get(origin_a, {}).get("borders", []))
    borders_b = set(all_countries.get(origin_b, {}).get("borders", []))
    geo_critical = (borders_a | borders_b) - {origin_a, origin_b}

    impact_by_code = {i["country_code"]: i for i in country_impacts}
    extra = [
        impact_by_code[code]
        for code in geo_critical
        if code not in top_codes and code in impact_by_code
    ]

    return top + extra


def _apply_multiplier(impact: dict, multiplier: float) -> dict:
    """
    Apply geo_multiplier to all SI fields and recalculate risk bands.
    Multiplier is clamped to [0.25, 3.0]; result capped at 1.0.
    """
    m   = max(0.25, min(3.0, float(multiplier)))
    cap = 1.0

    new_composite = round(min(cap, impact.get("composite_si",      0) * m), 3)
    new_energy    = round(min(cap, impact.get("energy_si",         0) * m), 3)
    new_trade     = round(min(cap, impact.get("trade_si",          0) * m), 3)
    new_food      = round(min(cap, impact.get("food_si",           0) * m), 3)
    new_base      = round(min(cap, impact.get("base_composite_si", 0) * m), 3)

    return {
        **impact,
        "composite_si":      new_composite,
        "energy_si":         new_energy,
        "trade_si":          new_trade,
        "food_si":           new_food,
        "base_composite_si": new_base,
        "risk_level":        get_risk_level(new_composite),
        "risk_color":        get_risk_color(new_composite),
    }


# ── Main public function ─────────────────────────────────────────────────────

async def apply_geo_relevance(
    country_impacts: list,
    origin_a:        str,
    origin_b:        str,
    origin_a_name:   str,
    origin_b_name:   str,
    wb_data:         dict,
    trade_data:      dict,
    shock_type:      str,
    intensity:       float,
    all_countries:   dict,
) -> list:
    """
    Calls Mistral to assign geo_multiplier values for the assessed countries,
    then applies them to the existing SI fields in country_impacts.

    Also overwrites affected_sectors and household_impact with geopolitically-
    informed text where Mistral has better context than the data-derived default.

    Returns the same list structure — only existing field values change.
    Falls back to the original list unchanged if Mistral errors.
    """
    if not MISTRAL_KEY or not country_impacts:
        return country_impacts

    assessed = _get_geo_assessment_countries(
        country_impacts, origin_a, origin_b, all_countries
    )

    rows         = "\n".join(_compact_row(i, wb_data, trade_data) for i in assessed)
    conflict_lens = _CONFLICT_LENS.get(shock_type, _CONFLICT_LENS["war"])

    prompt = f"""{GEO_REASONING_INSTRUCTION}

{_SCALE_GUIDE}

━━━ CONFLICT SCENARIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{shock_type.upper()} between {origin_a_name} ({origin_a}) and \
{origin_b_name} ({origin_b}) at {int(intensity * 100)}% intensity.

Conflict-type lens:
{conflict_lens}

━━━ COUNTRIES TO ASSESS ({len(assessed)} total) ━━━━━━━━━━━━━━━━━━━
Current mathematical scores — your job is to correct the ordering so it
reflects geopolitical reality, not just economic openness:
{rows}

━━━ TASK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each country that needs adjustment (geo_multiplier ≠ 1.0), return:
  "geo_multiplier": float in [0.25, 3.0] — see scale and examples above
  "sectors": 4-6 specific impacted sectors/commodities for this conflict.
     Cite actual % where available; name specific corridors, alliances, or
     supply chains from geopolitical knowledge where data is missing.
  "household_impact": 1-2 sentences. Specific to this country and this
     conflict. Never write generic "inflation will rise" text.
     Do not invent hard numerical forecasts or percentage changes unless
     directly supported by the supplied API data. Prefer qualitative analyst
     wording such as fertilizer prices rise, shipping costs increase,
     electronics supply disrupted, food inflation risk, fuel/LPG pressure,
     or defense supply delays.

IMPORTANT: You MUST reduce highly-open small economies that have no meaningful
geopolitical link to this conflict. Examples: Malta, Luxembourg, Ireland,
Iceland, Cyprus, Singapore, Hong Kong in most non-European/non-Asian conflicts.
Their high trade/GDP% is real but irrelevant to this scenario.

You MUST boost landlocked states, border countries, alliance members, and
countries with strategic energy/trade corridor exposure that the math misses.

Return ONLY valid JSON — no markdown, no explanation:
{{
  "CODE": {{
    "geo_multiplier": 2.80,
    "sectors": ["...", "..."],
    "household_impact": "..."
  }},
  ...
}}
"""

    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type":  "application/json"
    }
    payload = {
        "model":       "mistral-small-latest",
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": 0.15,
        "max_tokens":  5000
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            raw = response.json()

        content = raw["choices"][0]["message"]["content"].strip()

        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        adjustments: dict = json.loads(content)

        # Apply adjustments — preserve order of original country_impacts
        adjusted_map: dict = {}
        for impact in country_impacts:
            code = impact.get("country_code", "")
            adj  = adjustments.get(code)
            if not adj or not isinstance(adj, dict):
                adjusted_map[code] = impact
                continue

            new_impact = _apply_multiplier(impact, adj.get("geo_multiplier", 1.0))

            if adj.get("sectors"):
                new_impact["affected_sectors"] = adj["sectors"]
            if adj.get("household_impact"):
                new_impact["household_impact"] = adj["household_impact"]

            adjusted_map[code] = new_impact

        result = [adjusted_map.get(i.get("country_code", ""), i) for i in country_impacts]

        n_adj = sum(1 for c in adjustments if c in {i.get("country_code") for i in country_impacts})
        print(f"    Mistral geo-relevance: adjusted {n_adj}/{len(assessed)} assessed countries")
        return result

    except Exception as exc:
        print(f"    Mistral geo-relevance error: {exc} — original scores kept")
        return country_impacts
