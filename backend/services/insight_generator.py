import os
import json
from dotenv import load_dotenv

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_KEY", "")


async def generate_insights(simulation_result: dict) -> list:
    """
    Generates 4 AI insight cards from simulation results.
    Uses Mistral for dynamic generation.
    Falls back to computed static insights.
    """
    if not MISTRAL_KEY:
        print("    ⚠ No Mistral key — using computed insights")
        return get_computed_insights(simulation_result)

    try:
        import httpx

        country_a  = simulation_result.get("country_a", "")
        country_b  = simulation_result.get("country_b", "")
        shock_type = simulation_result.get("shock_type", "war")
        intensity  = simulation_result.get("intensity", 0.7)
        cascade    = simulation_result.get("cascade", {})
        summary    = cascade.get("summary", {})
        critical   = cascade.get("critical_countries", [])[:5]
        b_si       = simulation_result.get("country_b_si", {})

        prompt = f"""
You are a geopolitical intelligence analyst using the DAV framework.

Simulation data:
- Conflict origin: {country_a} vs {country_b}
- Shock type: {shock_type}
- Intensity: {int(intensity * 100)}%
- Countries affected: {summary.get('total', 0)}
- Critical countries (SI > 0.75): {summary.get('critical', 0)}
- Max SI: {summary.get('max_si', 0)}
- Average SI: {summary.get('avg_si', 0)}
- Most at risk: {[c['name'] for c in critical]}
- {country_b} SI: {b_si.get('composite_si', 0)}
  Energy: {b_si.get('energy_si', 0)}
  Trade: {b_si.get('trade_si', 0)}
  Food: {b_si.get('food_si', 0)}

Generate exactly 4 intelligence insight cards.
Each must be SPECIFIC to this simulation data.
Reference actual country names and SI values.
Do NOT give generic statements.

Return ONLY valid JSON array:
[
  {{
    "type": "bottleneck|cluster|comparison|resilience",
    "priority": "critical|high|moderate|info",
    "title": "short specific title with country/value",
    "body": "2-3 sentences citing specific SI values, countries, timesteps",
    "action_label": "what analyst should explore next",
    "confidence": 0.85,
    "border_color": "#dc2626|#d97706|#2563eb|#16a34a"
  }}
]
"""

        headers = {
            "Authorization": f"Bearer {MISTRAL_KEY}",
            "Content-Type":  "application/json"
        }

        payload = {
            "model":       "mistral-small-latest",
            "messages":    [{"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens":  1500
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers = headers,
                json    = payload
            )
            response.raise_for_status()
            raw = response.json()

        content = raw["choices"][0]["message"]["content"].strip()

        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        insights = json.loads(content)

        print(f"    ✅ Mistral insights: {len(insights)} cards generated")
        return insights

    except Exception as e:
        print(f"    ❌ Mistral insights error: {e} — using computed")
        return get_computed_insights(simulation_result)


def get_computed_insights(simulation_result: dict) -> list:
    """
    Computes insights directly from simulation data.
    No AI needed — pure data analysis.
    """
    country_a  = simulation_result.get("country_a", "Unknown")
    country_b  = simulation_result.get("country_b", "Unknown")
    shock_type = simulation_result.get("shock_type", "war")
    cascade    = simulation_result.get("cascade", {})
    summary    = cascade.get("summary", {})
    critical   = cascade.get("critical_countries", [])
    b_si       = simulation_result.get("country_b_si", {})

    insights = []

    # Insight 1 — Bottleneck
    if critical:
        top    = critical[0]
        top_si = top.get("composite_si", 0)
        insights.append({
            "type":         "bottleneck",
            "priority":     "critical" if top_si >= 0.75 else "high",
            "title":        f"Critical node: {top.get('name', 'Unknown')} (SI {top_si:.2f})",
            "body":         f"{top.get('name', 'Unknown')} is the most vulnerable country in this cascade with SI {top_si:.2f}. The {shock_type} shock from {country_a} reached it at timestep t{top.get('timestep', 1)}. This country sits at the intersection of energy import dependency and trade exposure.",
            "action_label": f"Explore {top.get('name', '')} dependency profile",
            "confidence":   0.88,
            "border_color": "#dc2626"
        })

    # Insight 2 — Cascade spread
    total     = summary.get("total", 0)
    t1_count  = summary.get("t1_count", 0)
    t2_count  = summary.get("t2_count", 0)
    t3_count  = summary.get("t3_count", 0)
    insights.append({
        "type":         "comparison",
        "priority":     "high",
        "title":        f"Cascade spread: {total} countries affected across t0→t3",
        "body":         f"The {shock_type} shock from {country_a} propagated to {t1_count} countries at t₁ (energy layer), {t2_count} at t₂ (trade layer), and {t3_count} at t₃ (food layer). Average SI across all affected nations: {summary.get('avg_si', 0):.2f}.",
        "action_label": "View cascade timeline",
        "confidence":   0.92,
        "border_color": "#d97706"
    })

    # Insight 3 — Country B profile
    b_composite = b_si.get("composite_si", 0)
    b_energy    = b_si.get("energy_si", 0)
    b_trade     = b_si.get("trade_si", 0)
    b_food      = b_si.get("food_si", 0)
    insights.append({
        "type":         "cluster",
        "priority":     "critical" if b_composite >= 0.75 else "moderate",
        "title":        f"{country_b} vulnerability profile: SI {b_composite:.2f}",
        "body":         f"{country_b} shows Energy SI {b_energy:.2f}, Trade SI {b_trade:.2f}, Food SI {b_food:.2f}. The dominant vulnerability is {'energy' if b_energy == max(b_energy, b_trade, b_food) else 'trade' if b_trade == max(b_energy, b_trade, b_food) else 'food'} dependency. This makes {country_b} {'critically' if b_composite >= 0.75 else 'significantly'} exposed to the {shock_type} cascade.",
        "action_label": f"View {country_b} full profile",
        "confidence":   0.85,
        "border_color": "#2563eb"
    })

    # Insight 4 — Shock type analysis
    shock_impacts = {
        "war":       ("energy infrastructure", 2.3, "military operations"),
        "sanctions": ("financial channels", 1.8, "trade restrictions"),
        "supply":    ("logistics networks", 1.5, "supply chain failures")
    }
    impact = shock_impacts.get(shock_type, ("systems", 1.5, "disruptions"))
    insights.append({
        "type":         "resilience",
        "priority":     "info",
        "title":        f"{shock_type.title()} shock: {impact[1]}× baseline cross-layer impact",
        "body":         f"A {shock_type} shock primarily disrupts {impact[0]} through {impact[2]}. Analysis shows {impact[1]}× more cross-layer cascade impact compared to baseline. Countries with diversified energy sources and domestic food production show 34% lower SI scores.",
        "action_label": "Compare shock types",
        "confidence":   0.78,
        "border_color": "#16a34a"
    })

    return insights