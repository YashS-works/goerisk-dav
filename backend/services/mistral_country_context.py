import os
import json
import httpx
from dotenv import load_dotenv
from services.mistral_geo_relevance import GEO_REASONING_INSTRUCTION

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_KEY") or os.getenv("MISTRAL_API_KEY", "")

# Fields this system never fetches — always tell Mistral to fill with knowledge
_ALWAYS_MISSING = [
    "military_spending_and_posture",
    "current_conflict_events",
    "sanctions_and_embargoes",
    "alliance_memberships (NATO/CSTO/SCO/Arab League etc.)",
    "political_stability_index",
]

_CONFLICT_DIMENSIONS = """
For the {shock_type} scenario between {a_name} and {b_name}, analyze each affected country across:
- Military consequences: escalation paths, border pressure, refugee flows
- Regional spillovers: neighboring-state exposure, proxy involvement
- Energy impacts: oil/gas supply disruption, price pass-through, LNG rerouting
- Supply-chain disruptions: manufacturing, electronics, critical minerals
- Food-security impacts: grain, fertilizer, shipping-route blockages
- Trade disruptions: sanctions bypass routes, port closures, shipping insurance spikes
- Alliance and diplomatic responses: third-party pressure, arms supply chains
- Currency and capital-flight effects: FX pressure, sovereign risk repricing
- Global market effects: commodity prices, equity/bond spillovers
Apply geopolitical knowledge for any dimension not covered by the provided API data.
"""


def _top_partners(code: str, trade_data: dict, n: int = 4) -> list:
    exports = trade_data.get(code, {}).get("exports", {})
    return [k for k, _ in sorted(exports.items(), key=lambda x: x[1], reverse=True)[:n]]


def _detect_missing(code: str, wb_data: dict, trade_data: dict) -> list:
    """
    Returns a list of field names that are unavailable for this country.
    Always-missing fields (military, sanctions, alliances) are included
    unconditionally; quantitative fields are added when the WB record is absent.
    """
    missing = list(_ALWAYS_MISSING)

    wb = wb_data.get(code)
    if wb is None:
        missing += ["energy_import_pct", "food_import_pct", "trade_gdp_pct", "gdp_usd"]
    else:
        if wb.get("energy_import_pct") is None:
            missing.append("energy_import_pct")
        if wb.get("food_import_pct") is None:
            missing.append("food_import_pct")
        if wb.get("trade_gdp_pct") is None:
            missing.append("trade_gdp_pct")

    if not trade_data.get(code, {}).get("exports"):
        missing.append("bilateral_trade_flows")

    return missing


def _country_data_block(impact: dict, wb_data: dict, trade_data: dict) -> str:
    code       = impact.get("country_code", "")
    name       = impact.get("name", code)
    wb         = wb_data.get(code, {})
    energy_pct = wb.get("energy_import_pct", 0) or 0
    food_pct   = wb.get("food_import_pct",   0) or 0
    trade_pct  = wb.get("trade_gdp_pct",     0) or 0
    partners   = _top_partners(code, trade_data)
    channels   = [c.get("label", "") for c in impact.get("exposure_channels", [])]
    missing    = _detect_missing(code, wb_data, trade_data)

    return (
        f"Country: {name} ({code})\n"
        f"  Composite SI: {impact.get('composite_si', 0):.3f} | "
        f"Energy SI: {impact.get('energy_si', 0):.3f} | "
        f"Trade SI: {impact.get('trade_si', 0):.3f} | "
        f"Food SI: {impact.get('food_si', 0):.3f}\n"
        f"  Energy import dependency: {energy_pct:.1f}%\n"
        f"  Food import dependency:   {food_pct:.1f}%\n"
        f"  Trade as % of GDP:        {trade_pct:.1f}%\n"
        f"  Top trade partners: {', '.join(partners) if partners else 'unknown'}\n"
        f"  Dominant channel: {impact.get('dominant_channel', 'mixed')}\n"
        f"  Exposure channels: {'; '.join(channels) if channels else 'none detected'}\n"
        f"  Missing data — use geopolitical knowledge for: {', '.join(missing)}\n"
    )


async def enrich_country_impacts(
    impacts:        list,
    origin_a:       str,
    origin_b:       str,
    origin_a_name:  str,
    origin_b_name:  str,
    wb_data:        dict,
    trade_data:     dict,
    shock_type:     str,
    intensity:      float
) -> list:
    """
    Calls Mistral once per simulation to generate AI-powered sector lists and
    household impact narratives for the top affected countries.

    Falls back to the data-derived text already in each impact if Mistral is
    unavailable or returns an unexpected response.
    """
    if not MISTRAL_KEY or not impacts:
        return impacts

    top = [i for i in impacts if i.get("composite_si", 0) > 0.05][:8]
    if not top:
        return impacts

    country_blocks = "\n".join(
        _country_data_block(i, wb_data, trade_data) for i in top
    )

    conflict_dims = _CONFLICT_DIMENSIONS.format(
        shock_type=shock_type,
        a_name=origin_a_name,
        b_name=origin_b_name
    )

    prompt = f"""{GEO_REASONING_INSTRUCTION}

Scenario: {shock_type.upper()} between {origin_a_name} ({origin_a}) and \
{origin_b_name} ({origin_b}) at {int(intensity * 100)}% intensity.

{conflict_dims}

Countries to analyze — real API data attached. Where fields are marked \
"Missing data", apply your geopolitical knowledge to produce informed, \
country-specific assessments rather than generic responses.

{country_blocks}

For EACH country, generate:
1. "sectors": array of 4-6 specific sectors or commodities impacted.
   - Where API data is available, cite the actual percentages (e.g. \
"crude oil imports — 42% energy dependency").
   - Where API data is missing, use geopolitical knowledge to identify \
realistic exposure (e.g. known trade dependencies, energy import routes, \
food import reliance from open-source knowledge).
2. "household_impact": 1-2 sentences on how ordinary households will \
feel this shock — fuel/LPG costs, food prices, employment, FX pressure, \
remittance flows, subsidy pressure etc. Be specific to this country and \
this conflict scenario; never write a generic sentence.
Avoid invented numerical forecasts or hard percentage changes unless the
number is directly present in the supplied API data. Prefer concrete analyst
effects: fertilizer prices rise, shipping costs increase, electronics supply
is disrupted, food inflation risk, fuel/LPG pressure, or defense procurement
delays.

Return ONLY a valid JSON object keyed by ISO-3 country code. \
No markdown, no explanation.
{{
  "IND": {{
    "sectors": ["crude oil imports (42% energy dependency)", "LPG/cylinder prices", ...],
    "household_impact": "Indian households will face higher petrol and LPG prices..."
  }},
  "PAK": {{ ... }}
}}
"""

    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type":  "application/json"
    }
    payload = {
        "model":       "mistral-small-latest",
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": 0.25,
        "max_tokens":  1800
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
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

        enrichments: dict = json.loads(content)

        enriched = []
        for impact in impacts:
            code = impact.get("country_code", "")
            ai   = enrichments.get(code, {})
            if ai and isinstance(ai, dict):
                enriched.append({
                    **impact,
                    "affected_sectors": ai.get("sectors",          impact.get("affected_sectors", [])),
                    "household_impact": ai.get("household_impact", impact.get("household_impact", ""))
                })
            else:
                enriched.append(impact)

        print(f"    Mistral country context: enriched {len(enrichments)} countries")
        return enriched

    except Exception as exc:
        print(f"    Mistral country context error: {exc} — keeping data-derived context")
        return impacts
