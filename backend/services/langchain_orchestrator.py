"""
Hybrid AI geo-relevance orchestration pipeline.

Pipeline per simulation run:
  Step 1a — Mistral: sectors + household_impact for top-8 countries
  Step 1b — Mistral: geo_multipliers for top-40 + border countries
  Step 2  — OpenAI GPT-4o-mini: validates rankings, adds real-world consequence chains
             Falls back to Mistral if OpenAI unavailable.

All API calls use httpx directly — same pattern as the rest of the codebase.

Public API:
  run_hybrid_geo_pipeline()  → routers/simulation.py
  langchain_llm_call()       → services/insight_generator.py
                             → services/quiz_generator.py

Fallback contract:
  If OPENAI_KEY absent       → uses Mistral for Step 2
  If any step errors         → returns last good result; simulation always completes
"""

import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_KEY") or os.getenv("MISTRAL_API_KEY", "")
OPENAI_KEY  = os.getenv("OPENAI_KEY") or os.getenv("OPENAI_API_KEY", "")

_OPENAI_MODEL  = os.getenv("OPENAI_MODEL",  "gpt-4o-mini")
_MISTRAL_MODEL = "mistral-small-latest"

_OPENAI_URL  = "https://api.openai.com/v1/chat/completions"
_MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"


def _load_langchain():
    """Load LangChain lazily so missing optional deps do not break startup."""
    try:
        from langchain.prompts import PromptTemplate
        from langchain.output_parsers import ResponseSchema, StructuredOutputParser
        from langchain_core.runnables import RunnableLambda, RunnableSequence
        from langchain_openai import ChatOpenAI

        return {
            "PromptTemplate": PromptTemplate,
            "ResponseSchema": ResponseSchema,
            "StructuredOutputParser": StructuredOutputParser,
            "RunnableLambda": RunnableLambda,
            "RunnableSequence": RunnableSequence,
            "ChatOpenAI": ChatOpenAI,
        }
    except Exception as exc:
        print(f"    LangChain unavailable: {exc}")
        return None


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _parse_json_robust(text: str) -> object:
    """Parse JSON from LLM response, tolerating markdown fences."""
    s = text.strip()
    if "```" in s:
        for segment in s.split("```"):
            candidate = segment.lstrip("json").lstrip("JSON").strip()
            if candidate.startswith(("{", "[")):
                try:
                    return json.loads(candidate)
                except Exception:
                    pass
    for open_ch, close_ch in [("{", "}"), ("[", "]")]:
        start = s.find(open_ch)
        end   = s.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(s[start : end + 1])
            except Exception:
                pass
    return json.loads(s)


async def _call_openai(prompt: str, temperature: float = 0.20, max_tokens: int = 3500) -> str:
    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model":       _OPENAI_MODEL,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(_OPENAI_URL, headers=headers, json=payload)
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


async def _call_mistral(prompt: str, temperature: float = 0.15, max_tokens: int = 2500) -> str:
    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model":       _MISTRAL_MODEL,
        "messages":    [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(_MISTRAL_URL, headers=headers, json=payload)
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


# ─── Public: generic LLM call (insight / quiz generators) ────────────────────

async def langchain_llm_call(
    prompt:      str,
    temperature: float = 0.30,
    max_tokens:  int   = 2000,
    # prefer_gemini kept for signature compat but ignored
    prefer_gemini: bool = True,
) -> str:
    """
    Single async LLM call. OpenAI primary, Mistral fallback.
    Raises RuntimeError if no key is configured.
    """
    if not OPENAI_KEY and not MISTRAL_KEY:
        raise RuntimeError("No AI key configured (OPENAI_KEY / MISTRAL_KEY)")

    if OPENAI_KEY:
        try:
            result = await _call_openai(prompt, temperature=temperature, max_tokens=max_tokens)
            print(f"    OpenAI ({_OPENAI_MODEL}): call succeeded")
            return result
        except Exception as e:
            print(f"    OpenAI failed: {e} — trying Mistral")

    if MISTRAL_KEY:
        result = await _call_mistral(prompt, temperature=temperature, max_tokens=max_tokens)
        print(f"    Mistral ({_MISTRAL_MODEL}): call succeeded")
        return result

    raise RuntimeError("All AI providers failed")


async def validate_cascade_with_openai(
    cascade: dict,
    origin_a: str,
    origin_b: str,
    origin_a_name: str,
    origin_b_name: str,
    all_countries: dict,
    wb_data: dict,
    food_data: dict,
    shock_type: str,
    intensity: float,
) -> dict:
    """
    OpenAI cascade validation layer. It may reorder/promote/remove countries in
    t1-t3 but keeps the existing cascade response schema. Falls back unchanged.
    """
    if not OPENAI_KEY or (shock_type or "war").lower() != "war":
        return cascade

    current = {
        step: [
            {
                "code": code,
                "name": all_countries.get(code, {}).get("name", code),
                "si": data.get("composite_si", 0),
            }
            for code, data in cascade.get(step, {}).items()
        ]
        for step in ("t0", "t1", "t2", "t3")
    }
    allowed_codes = sorted(all_countries.keys())
    prompt = f"""
You are a geopolitical intelligence analyst validating a war cascade.

Conflict: {origin_a_name} ({origin_a}) vs {origin_b_name} ({origin_b})
Current cascade: {json.dumps(current, ensure_ascii=True)}

Question: Would Reuters, RAND, CSIS, IMF, World Bank, or a geopolitical analyst
consider these countries among the most affected?

Check geography, borders, regional proximity, energy routes, trade routes,
alliances, military relevance, supply chains, and historical precedents.

Rules:
- Keep t0 as exactly [{origin_a}, {origin_b}].
- For t1, return 3 to 5 immediate countries: borders, neighbors, strategic partners.
- For t2, return 3 to 5 regional powers or supply-chain countries.
- For t3, return 3 to 5 global spillovers.
- Do not repeat countries across t1, t2, t3.
- Do not include random distant countries.
- Use only ISO3 codes from this list: {allowed_codes}

Historical checks:
- India-China: t1 Pakistan, Nepal, Bhutan, Bangladesh, Myanmar; t2 Japan,
  South Korea, Taiwan, Singapore, Vietnam, Thailand, Malaysia.
- Russia-India: t1 China, Kazakhstan, Belarus, Mongolia, Nepal; t2 Pakistan,
  Bangladesh, Bhutan, UAE, Saudi Arabia.
- US-Iran: t1 Saudi Arabia, UAE, Iraq, Turkey, Israel; t2 India, China,
  Pakistan, Egypt, Japan, South Korea.
- Russia-Ukraine: Europe first via energy/food.
- Russia-USA: Baltics, Poland, Finland, Belarus, Kazakhstan first.

Supply-chain knowledge:
- Russia: fertilizers, wheat, defense exports, natural gas.
- China: electronics, semiconductors, rare earths, manufacturing.
- India: pharmaceuticals, IT services, fertilizers, refined petroleum.
- USA: finance, technology, semiconductors, reserve currency.
- Japan: automotive, semiconductor equipment.
- South Korea: semiconductors, shipbuilding.
- Taiwan: advanced semiconductor manufacturing.

Return ONLY JSON:
{{"t1":["AAA","BBB","CCC"],"t2":["DDD","EEE","FFF"],"t3":["GGG","HHH","III"]}}
"""
    try:
        raw = await _call_openai(prompt, temperature=0.1, max_tokens=900)
        parsed = _parse_json_robust(raw)
        if not isinstance(parsed, dict):
            return cascade

        from services.cascade_engine import _compute_layer_si, _rebuild_summary

        corrected = {
            **cascade,
            "t0": cascade.get("t0", {}),
            "t1": {},
            "t2": {},
            "t3": {},
            "cascade_path": [],
            "a_affected": [],
            "b_affected": [],
        }
        used = set(corrected["t0"].keys())
        previous_sources = [origin_a, origin_b]
        for layer in ("t1", "t2", "t3"):
            codes = parsed.get(layer, [])
            if not isinstance(codes, list):
                return cascade
            clean_codes = []
            for code in codes:
                code = str(code).upper()
                if code in all_countries and code not in used and code not in (origin_a, origin_b):
                    clean_codes.append(code)
                    used.add(code)
                if len(clean_codes) >= 5:
                    break
            if len(clean_codes) < 3:
                return cascade
            for idx, code in enumerate(clean_codes):
                from_code = previous_sources[idx % max(len(previous_sources), 1)]
                corrected[layer][code] = _compute_layer_si(
                    code, layer, from_code, wb_data, food_data, shock_type, intensity
                )
                corrected[layer][code]["affected_by"] = "scenario"
            previous_sources = clean_codes

        domains = {"t0": "origin", "t1": "energy", "t2": "trade", "t3": "food"}
        for step in ("t0", "t1", "t2", "t3"):
            for code, data in corrected.get(step, {}).items():
                corrected["cascade_path"].append({
                    "step": step,
                    "country": code,
                    "name": all_countries.get(code, {}).get("name", code),
                    "si": data.get("composite_si", 0),
                    "domain": domains.get(step, "unknown"),
                    "source": data.get("affected_by", "scenario"),
                    "affected_by": data.get("affected_by", "scenario"),
                })
        corrected["a_affected"] = cascade.get("a_affected", [])
        corrected["b_affected"] = cascade.get("b_affected", [])
        print("    OpenAI cascade validation: corrected cascade accepted")
        return _rebuild_summary(corrected, all_countries)
    except Exception as exc:
        print(f"    OpenAI cascade validation failed: {exc} - deterministic cascade kept")
        return cascade


# ─── Helpers for geo pipeline ─────────────────────────────────────────────────

def _fmt_country_row(impact: dict, wb_data: dict, trade_data: dict) -> str:
    code    = impact.get("country_code", "")
    name    = impact.get("name", code)
    wb      = wb_data.get(code, {})
    en_pct  = wb.get("energy_import_pct", 0) or 0
    fo_pct  = wb.get("food_import_pct",   0) or 0
    tr_pct  = wb.get("trade_gdp_pct",     0) or 0
    exports = trade_data.get(code, {}).get("exports", {})
    top_pts = [k for k, _ in sorted(exports.items(), key=lambda x: x[1], reverse=True)[:3]]
    pts_str = ", ".join(top_pts) if top_pts else "unknown"
    sectors = "; ".join(impact.get("affected_sectors", [])[:3]) or "—"
    return (
        f"  {code} ({name}): SI={impact.get('composite_si', 0):.3f} "
        f"[E={impact.get('energy_si', 0):.3f} T={impact.get('trade_si', 0):.3f} "
        f"F={impact.get('food_si', 0):.3f}] "
        f"energy={en_pct:.1f}% food={fo_pct:.1f}% trade/GDP={tr_pct:.1f}% "
        f"partners=[{pts_str}] mistral_sectors=[{sectors}]"
    )


def _apply_geo_multiplier(impact: dict, multiplier: float) -> dict:
    from services.si_calculator import get_risk_level, get_risk_color
    m        = max(0.25, min(3.0, float(multiplier)))
    cap      = 1.0
    new_si   = round(min(cap, impact.get("composite_si",      0) * m), 3)
    new_en   = round(min(cap, impact.get("energy_si",         0) * m), 3)
    new_tr   = round(min(cap, impact.get("trade_si",          0) * m), 3)
    new_fo   = round(min(cap, impact.get("food_si",           0) * m), 3)
    new_base = round(min(cap, impact.get("base_composite_si", 0) * m), 3)
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


def _geo_assessment_set(
    country_impacts: list,
    origin_a:        str,
    origin_b:        str,
    all_countries:   dict,
    top_n:           int = 40,
) -> list:
    """Top-N by SI  UNION  direct border countries — guarantees Mongolia, Kazakhstan, etc."""
    sorted_impacts = sorted(
        country_impacts, key=lambda x: x.get("composite_si", 0), reverse=True
    )
    top        = sorted_impacts[:top_n]
    top_codes  = {i["country_code"] for i in top}
    borders_a  = set(all_countries.get(origin_a, {}).get("borders", []))
    borders_b  = set(all_countries.get(origin_b, {}).get("borders", []))
    geo_extra  = (borders_a | borders_b) - {origin_a, origin_b}
    by_code    = {i["country_code"]: i for i in country_impacts}
    extra      = [by_code[c] for c in geo_extra if c not in top_codes and c in by_code]
    return top + extra


# ─── Known geopolitical patterns per conflict pair ────────────────────────────

_CONFLICT_PATTERNS = {
    ("RUS", "CHN"): (
        "PROMOTE: Mongolia (borders both, Trans-Mongolian rail corridor critical), "
        "Kazakhstan (BRI energy hub, SCO member), Japan/South Korea (Russian resource supply chains), "
        "Belarus (CSTO ally, Russia-dependent economy), North Korea (Russia border + arms flows). "
        "DEMOTE: Malta, Luxembourg, Ireland, Iceland (small open economies, zero conflict linkage). "
        "Trans-Siberian rail disruption hits Japanese auto/electronics component supply."
    ),
    ("CHN", "RUS"): (
        "PROMOTE: Mongolia (borders both, rail corridors), Kazakhstan (BRI + energy), "
        "Japan, South Korea (tech/auto supply chain), Belarus, North Korea. "
        "DEMOTE: Malta, Luxembourg, Ireland, Iceland. "
        "BRI commodity corridors: coal, oil, grain via Trans-Siberian and rail routes."
    ),
    ("IND", "PAK"): (
        "PROMOTE: Afghanistan (border/refugee pressure), Iran (proxy dynamics, Chabahar port), "
        "Bangladesh (regional trade disruption, Indian Ocean lanes), Sri Lanka (Indian Ocean shipping). "
        "Nuclear escalation risk premiums elevate all regional assets. "
        "Bangladesh garment exports hit if South Asian corridor disrupted."
    ),
    ("PAK", "IND"): (
        "PROMOTE: Afghanistan, Iran, Bangladesh, Sri Lanka. "
        "Nuclear escalation risk. Bangladesh garment supply chain at risk."
    ),
    ("IND", "CHN"): (
        "PROMOTE: Nepal/Bhutan (buffer states, Himalayan border zone), Bangladesh (supply chain node), "
        "South Korea/Taiwan (electronics chains China-dependent, rerouting costs). "
        "India imports 65%+ of API pharmaceuticals from China — drug shortage cascade. "
        "Indian Ocean and Malacca Strait shipping pressure. "
        "DEMOTE: Ireland, Luxembourg, Malta (no India-China linkage)."
    ),
    ("CHN", "IND"): (
        "PROMOTE: Nepal, Bhutan (buffer states), Bangladesh, South Korea, Taiwan. "
        "Pharma API shortage risk globally. Malacca Strait pressure. "
        "DEMOTE: Ireland, Luxembourg, Malta."
    ),
    ("RUS", "UKR"): (
        "PROMOTE: Poland (NATO eastern flank, refugee host), Moldova (border, energy-dependent), "
        "Romania (Black Sea, NATO), Hungary (Russian gas dependency), "
        "Turkey (Bosphorus chokepoint, grain corridor mediator), Germany (gas dependency). "
        "Black Sea grain corridor: Egypt, Lebanon, Yemen, Tunisia most exposed (wheat importers). "
        "DEMOTE: Singapore, New Zealand, Australia."
    ),
    ("UKR", "RUS"): (
        "PROMOTE: Poland, Moldova, Romania, Hungary, Turkey, Germany, Egypt, Lebanon, Yemen, Tunisia. "
        "Black Sea grain corridor critical for MENA food security. "
        "DEMOTE: Singapore, New Zealand, Australia."
    ),
    ("USA", "CHN"): (
        "PROMOTE: Taiwan (first-island-chain, 37% global semiconductor capacity), "
        "South Korea (THAAD, Samsung supply chains), Japan (US treaty ally, auto+electronics), "
        "Philippines (South China Sea, US base access), Vietnam (manufacturing relocation hub), "
        "Australia (AUKUS, iron ore exports to China). "
        "DEMOTE: landlocked Central Europe. Taiwan Strait closure = global chip crisis."
    ),
    ("CHN", "USA"): (
        "PROMOTE: Taiwan, South Korea, Japan, Philippines, Vietnam, Australia. "
        "DEMOTE: landlocked Central Europe. Taiwan Strait = semiconductor chokepoint."
    ),
}

_CONFLICT_LENS = {
    "war": (
        "Prioritise: shared borders, military alliance triggers (NATO/CSTO/SCO), "
        "energy supply disruption, refugee pressure, naval chokepoints "
        "(Hormuz, Malacca, Bosphorus, Suez), food-export-ban cascade."
    ),
    "sanctions": (
        "Prioritise: secondary-sanction exposure, SWIFT/payment dependence, "
        "energy rerouting, third-country evasion routes (India, China, Turkey, UAE), "
        "technology decoupling."
    ),
    "supply": (
        "Prioritise: just-in-time manufacturing exposure, port/chokepoint proximity, "
        "commodity stockpile depth, alternative sourcing lead times, "
        "freight/insurance spikes, food and energy import reliance."
    ),
}

_SCALE_GUIDE = """\
GEO_MULTIPLIER SCALE (final_si = composite_si × geo_multiplier, capped 1.0):
  3.00  → Direct conflict participant
  2.50–2.99 → Borders both parties OR extreme strategic dependence
  2.00–2.49 → Major regional power / strong alliance / energy corridor
  1.50–1.99 → Significant indirect exposure: adjacent region, key supply chain
  1.10–1.49 → Moderate geopolitical relevance beyond math
  1.00       → Math score accurate — omit from output
  0.70–0.99 → Slightly over-weighted
  0.40–0.69 → Materially over-weighted — high trade/GDP, limited conflict link
  0.25–0.39 → Strongly over-weighted — small open economy, no conflict connection
              (Malta, Luxembourg, Ireland, Iceland, Cyprus in most non-European conflicts)\
"""

_CONSEQUENCE_CHAINS = """\
CONSEQUENCE CHAINS — trace for affected countries:
  Energy disruption → LPG/cooking-gas → transport costs → fertilizer (urea) → food inflation
  Energy disruption → diesel/petrol → freight → consumer price index → subsidy strain
  Trade disruption  → manufacturing inputs → factory output → employment → household income
  Food disruption   → grain/wheat supply → flour/bread → subsidy pressure → social instability
  Shipping risk     → freight insurance → import costs → retail prices → household basket\
"""


def _build_geo_prompt(
    origin_a_name: str, origin_a: str,
    origin_b_name: str, origin_b: str,
    shock_type: str, intensity: float,
    rows: str,
) -> str:
    fwd = (origin_a, origin_b)
    rev = (origin_b, origin_a)
    geo_patterns  = _CONFLICT_PATTERNS.get(fwd) or _CONFLICT_PATTERNS.get(rev) or \
                    "Apply general geopolitical knowledge for this conflict pair."
    conflict_lens = _CONFLICT_LENS.get(shock_type, _CONFLICT_LENS["war"])

    return f"""\
You are a senior geopolitical intelligence analyst reviewing AI-generated conflict spillover scores.

TASK: Validate and CORRECT country rankings for geopolitical realism — not just mathematical trade/energy openness.
A small highly-open economy is NOT necessarily exposed to a specific bilateral conflict.
A landlocked border state with low trade/GDP may be critically exposed.

━━━ CONFLICT SCENARIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{shock_type.upper()} between {origin_a_name} ({origin_a}) and {origin_b_name} ({origin_b}) at {int(intensity*100)}% intensity

━━━ CONFLICT-TYPE LENS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{conflict_lens}

━━━ KNOWN PATTERNS FOR THIS CONFLICT PAIR ━━━━━━━━━━━━━━━━━
{geo_patterns}

━━━ GEO_MULTIPLIER SCALE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{_SCALE_GUIDE}

━━━ REAL-WORLD CONSEQUENCE CHAINS ━━━━━━━━━━━━━━━━━━━━━━━━━
{_CONSEQUENCE_CHAINS}

━━━ CURRENT RANKINGS (after Mistral adjustment) ━━━━━━━━━━━
{rows}

━━━ YOUR OUTPUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For countries needing correction (geo_multiplier ≠ 1.0):
- MUST demote small open economies with no conflict linkage
- MUST promote border states, alliance members, corridor states
- Cite named corridors, alliances, supply chains — not vague generalities
- Trace consequence chains (LPG → fertilizer → food inflation etc.)
- Use historical precedents, trade dependencies, energy routes, food supply
  chains, technology supply chains, and defense supply chains.
- Prefer qualitative analyst wording such as "fertilizer prices rise",
  "shipping costs increase", "electronics supply is disrupted", and
  "food inflation risk".
- Do NOT invent specific numerical forecasts such as "50-60% increase",
  "90% revenue", or hard percentage changes unless the value is directly
  present in the supplied data rows.
- Do NOT recalculate SI — only assign geo_multiplier

Return ONLY valid JSON (no markdown, no explanation):
{{
  "IND": {{
    "geo_multiplier": 1.9,
    "sectors": ["crude oil imports (87% import-dependent)", "LPG/cooking-gas cylinder prices", "urea fertilizer imports", "shipping insurance surcharges"],
    "household_impact": "Indian households face LPG and diesel cost pressure as Russian crude discounts and fertilizer-linked import channels tighten.",
    "reason": "India sources ~40% of crude from Russia at discount; conflict disrupts supply and insurance rates"
  }},
  "MLT": {{
    "geo_multiplier": 0.28,
    "sectors": ["tourism receipts", "financial services"],
    "household_impact": "Malta has no direct energy or food import link to this conflict; high trade/GDP reflects re-export activity unrelated to the scenario.",
    "reason": "Small island economy; trade/GDP ratio is structural, not conflict-linked"
  }}
}}
"""


# ─── Internal: AI geo-validation step ────────────────────────────────────────

async def _run_ai_geo_validation(
    country_impacts: list,
    origin_a: str, origin_b: str,
    origin_a_name: str, origin_b_name: str,
    wb_data: dict, trade_data: dict,
    shock_type: str, intensity: float,
    all_countries: dict,
) -> list:
    """OpenAI geopolitical validation chain with Mistral-only fallback."""
    if not OPENAI_KEY:
        print("    OpenAI geo-validation: OPENAI key absent - Mistral-only mode")
        return country_impacts

    lc = _load_langchain()
    if not lc:
        print("    OpenAI geo-validation: LangChain unavailable - Mistral-only mode")
        return country_impacts

    assessed = _geo_assessment_set(country_impacts, origin_a, origin_b, all_countries)
    rows     = "\n".join(_fmt_country_row(i, wb_data, trade_data) for i in assessed)
    analysis_prompt = _build_geo_prompt(
        origin_a_name, origin_a, origin_b_name, origin_b,
        shock_type, intensity, rows,
    )
    mistral_snapshot = json.dumps(assessed[:40], ensure_ascii=True, default=str)

    ResponseSchema = lc["ResponseSchema"]
    StructuredOutputParser = lc["StructuredOutputParser"]
    PromptTemplate = lc["PromptTemplate"]
    ChatOpenAI = lc["ChatOpenAI"]
    RunnableLambda = lc["RunnableLambda"]
    RunnableSequence = lc["RunnableSequence"]

    output_parser = StructuredOutputParser.from_response_schemas([
        ResponseSchema(
            name="corrections",
            description=(
                "Object keyed by ISO-3 country code. Each value includes "
                "geo_multiplier, geopolitical_relevance_score, sectors, "
                "household_impact, reason, and real_world_consequences."
            ),
        ),
        ResponseSchema(
            name="ranking_corrections",
            description="Array of concise promote/demote ranking decisions.",
        ),
        ResponseSchema(
            name="over_ranked",
            description="Array of ISO-3 codes over-ranked by economic openness.",
        ),
        ResponseSchema(
            name="under_ranked",
            description="Array of ISO-3 codes under-ranked geopolitically.",
        ),
        ResponseSchema(
            name="real_world_consequences",
            description="Array of scenario-specific analyst-quality consequences.",
        ),
    ])

    prompt = PromptTemplate(
        template=(
            "{analysis_prompt}\n\n"
            "MISTRAL ANALYSIS SNAPSHOT:\n{mistral_snapshot}\n\n"
            "You are the OpenAI geopolitical validation layer. Review the "
            "simulation output and determine whether rankings are "
            "geopolitically realistic. Use geography, military relevance, "
            "border exposure, strategic alliances, regional influence, supply "
            "chain importance, shipping routes, energy routes, and historical "
            "relationships. Do NOT recalculate SI. Instead assign "
            "geo_multiplier values in [0.25, 3.0] and explain real-world "
            "consequences with named supply, energy, food, or shipping channels. "
            "Avoid generic statements.\n\n"
            "Analyst test: Would a geopolitical analyst realistically discuss "
            "this country as one of the most affected by this conflict? If no, "
            "reduce the multiplier. If yes, increase it.\n\n"
            "Reject economic-openness-biased rankings where Estonia outranks "
            "Nepal in an India-China conflict, Lithuania outranks Pakistan in "
            "an India-China conflict, Malta outranks Mongolia in a Russia-China "
            "conflict, or Luxembourg outranks Japan in major Asian conflicts.\n\n"
            "Return JSON using this schema:\n{format_instructions}"
        ),
        input_variables=["analysis_prompt", "mistral_snapshot"],
        partial_variables={"format_instructions": output_parser.get_format_instructions()},
    )
    llm = ChatOpenAI(
        model=_OPENAI_MODEL,
        api_key=OPENAI_KEY,
        temperature=0.20,
        max_tokens=3500,
    )
    openai_sequence = prompt | llm | output_parser
    if not isinstance(openai_sequence, RunnableSequence):
        print("    OpenAI validation chain: RunnableSequence wrapper active")
    openai_validation_chain = openai_sequence.with_retry(stop_after_attempt=2)

    def _merge_validation(payload: dict) -> list:
        validation = payload.get("validation") or {}
        corrections = validation.get("corrections", validation)
        if not isinstance(corrections, dict):
            return country_impacts

        impact_map = {i["country_code"]: i for i in country_impacts}
        n_applied = 0

        for code, correction in corrections.items():
            if not isinstance(correction, dict) or code not in impact_map:
                continue
            new_impact = _apply_geo_multiplier(
                impact_map[code],
                correction.get("geo_multiplier", 1.0),
            )

            ai_sectors = correction.get("sectors", [])
            if not ai_sectors and correction.get("real_world_consequences"):
                ai_sectors = correction.get("real_world_consequences", [])
            old_sectors = new_impact.get("affected_sectors", [])
            merged = ai_sectors + [s for s in old_sectors if s not in ai_sectors]
            if merged:
                new_impact["affected_sectors"] = merged[:6]

            consequence_text = correction.get("household_impact") or correction.get("reason")
            if consequence_text:
                new_impact["household_impact"] = consequence_text

            impact_map[code] = new_impact
            n_applied += 1

        print(f"    OpenAI geo-validation: {n_applied}/{len(assessed)} countries corrected")
        return [impact_map.get(i["country_code"], i) for i in country_impacts]

    merge_chain = RunnableLambda(lambda payload: payload) | RunnableLambda(_merge_validation)

    try:
        validation = await openai_validation_chain.ainvoke({
            "analysis_prompt": analysis_prompt,
            "mistral_snapshot": mistral_snapshot,
        })
        return await merge_chain.ainvoke({"validation": validation})
    except Exception as e:
        print(f"    OpenAI geo-validation failed: {e} - Mistral-only mode")
        return country_impacts


# ─── Public: main geo pipeline ────────────────────────────────────────────────

async def run_hybrid_geo_pipeline(
    country_impacts:    list,
    top_for_enrichment: list,
    origin_a:           str,
    origin_b:           str,
    origin_a_name:      str,
    origin_b_name:      str,
    wb_data:            dict,
    trade_data:         dict,
    shock_type:         str,
    intensity:          float,
    all_countries:      dict,
) -> list:
    """
    Parallel Mistral geo-relevance pipeline.

    Step 1a and Step 1b run IN PARALLEL to stay within the 30s frontend timeout:
      Step 1a — Mistral: sectors + household_impact for top-8 countries
      Step 1b — Mistral: geo_multipliers for top-25 + border countries

    Results are merged: Step 1b provides geo-adjusted SI values, Step 1a provides
    richer sector/household text for the 8 most-affected countries.

    The deterministic geo_ranker in simulation.py runs after this as a safety floor.
    OpenAI is reserved for insights and quiz (smaller, separate calls).

    Falls back gracefully at every stage so simulation always returns a result.
    """
    import asyncio
    from services.mistral_country_context import enrich_country_impacts
    from services.mistral_geo_relevance   import apply_geo_relevance

    async def _parallel_mistral_steps(payload: dict):
        return await asyncio.gather(
            enrich_country_impacts(
                impacts       = payload["top_for_enrichment"],
                origin_a      = payload["origin_a"],
                origin_b      = payload["origin_b"],
                origin_a_name = payload["origin_a_name"],
                origin_b_name = payload["origin_b_name"],
                wb_data       = payload["wb_data"],
                trade_data    = payload["trade_data"],
                shock_type    = payload["shock_type"],
                intensity     = payload["intensity"],
            ),
            apply_geo_relevance(
                country_impacts = payload["country_impacts"],
                origin_a        = payload["origin_a"],
                origin_b        = payload["origin_b"],
                origin_a_name   = payload["origin_a_name"],
                origin_b_name   = payload["origin_b_name"],
                wb_data         = payload["wb_data"],
                trade_data      = payload["trade_data"],
                shock_type      = payload["shock_type"],
                intensity       = payload["intensity"],
                all_countries   = payload["all_countries"],
            ),
            return_exceptions=True,
        )

    mistral_inputs = {
        "country_impacts": country_impacts,
        "top_for_enrichment": top_for_enrichment,
        "origin_a": origin_a,
        "origin_b": origin_b,
        "origin_a_name": origin_a_name,
        "origin_b_name": origin_b_name,
        "wb_data": wb_data,
        "trade_data": trade_data,
        "shock_type": shock_type,
        "intensity": intensity,
        "all_countries": all_countries,
    }

    # ── Run Step 1a and Step 1b in PARALLEL ──────────────────────────────────
    # Both start from the same original country_impacts.
    # Parallel execution cuts total wait from ~80s sequential to ~20s max.
    try:
        lc = _load_langchain()
        if lc:
            RunnableLambda = lc["RunnableLambda"]
            mistral_chain = (
                RunnableLambda(lambda payload: payload)
                | RunnableLambda(_parallel_mistral_steps)
            )
            results = await mistral_chain.with_retry(
                stop_after_attempt=2
            ).ainvoke(mistral_inputs)
        else:
            results = await _parallel_mistral_steps(mistral_inputs)
        enriched_top, geo_adjusted = results

    except Exception as exc:
        print(f"    Pipeline gather error: {exc} — using original impacts")
        return country_impacts

    # ── Step 1b result: geo-adjusted SI values for all assessed countries ─────
    if isinstance(geo_adjusted, Exception):
        print(f"    Mistral geo-relevance error: {geo_adjusted} — using original SI")
        final_impacts = country_impacts
    else:
        final_impacts = geo_adjusted

    # ── Step 1a result: overlay richer sector/household text for top-8 ───────
    if isinstance(enriched_top, Exception):
        print(f"    Mistral country context error: {enriched_top} — using geo-relevance sectors")
    elif isinstance(enriched_top, list):
        enrichment_by_code = {i["country_code"]: i for i in enriched_top}
        final_impacts = [
            {
                **impact,
                "affected_sectors": enrichment_by_code[impact["country_code"]].get(
                    "affected_sectors", impact.get("affected_sectors", [])
                ),
                "household_impact": enrichment_by_code[impact["country_code"]].get(
                    "household_impact", impact.get("household_impact", "")
                ),
            }
            if impact.get("country_code") in enrichment_by_code
            else impact
            for impact in final_impacts
        ]

    final_impacts = await _run_ai_geo_validation(
        country_impacts = final_impacts,
        origin_a        = origin_a,
        origin_b        = origin_b,
        origin_a_name   = origin_a_name,
        origin_b_name   = origin_b_name,
        wb_data         = wb_data,
        trade_data      = trade_data,
        shock_type      = shock_type,
        intensity       = intensity,
        all_countries   = all_countries,
    )

    print("    Pipeline (Mistral + OpenAI validation): complete")
    return final_impacts
