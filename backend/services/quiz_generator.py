import os
import json
from dotenv import load_dotenv

load_dotenv()

MISTRAL_KEY = os.getenv("MISTRAL_KEY", "")


async def generate_quiz(simulation_result: dict, num_questions: int = 5) -> list:
    """
    Auto-generates quiz questions from simulation results.
    Uses Mistral AI to create context-specific questions.
    Falls back to static questions if Mistral unavailable.
    """
    if not MISTRAL_KEY:
        print("    ⚠ No Mistral key — using fallback quiz")
        return get_fallback_quiz(simulation_result)

    try:
        import httpx

        country_a  = simulation_result.get("country_a", "Unknown")
        country_b  = simulation_result.get("country_b", "Unknown")
        shock_type = simulation_result.get("shock_type", "war")
        intensity  = simulation_result.get("intensity", 0.7)
        cascade    = simulation_result.get("cascade", {})
        summary    = cascade.get("summary", {})
        critical   = cascade.get("critical_countries", [])[:3]

        prompt = f"""
You are a geopolitical risk educator creating a quiz about a DAV simulation.

Simulation details:
- Conflict: {country_a} vs {country_b}
- Shock type: {shock_type}
- Intensity: {int(intensity * 100)}%
- Total countries affected: {summary.get('total', 0)}
- Critical countries: {[c['name'] for c in critical]}
- Max SI reached: {summary.get('max_si', 0)}
- Average SI: {summary.get('avg_si', 0)}

Generate exactly {num_questions} multiple choice questions about THIS simulation.
Questions must test understanding of:
1. Why specific countries scored high SI
2. The cascade mechanism (energy to trade to food)
3. What the SI values mean
4. Cross-domain spillover effects
5. Real geopolitical implications

Return ONLY valid JSON array, no markdown, no explanation:
[
  {{
    "domain": "Energy|Trade|Food|Spillover Index|Cascade Model",
    "question": "specific question referencing actual simulation data",
    "options": ["option A", "option B", "option C", "option D"],
    "correct_index": 0,
    "explanation": "why this answer is correct based on simulation",
    "xp": 75
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
            "temperature": 0.3,
            "max_tokens":  2000
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

        # Clean markdown fences if present
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        questions = json.loads(content)

        # Validate structure
        valid = []
        for q in questions:
            if all(k in q for k in ["domain","question","options","correct_index","xp"]):
                valid.append(q)

        print(f"    ✅ Mistral quiz: {len(valid)} questions generated")
        return valid if valid else get_fallback_quiz(simulation_result)

    except Exception as e:
        print(f"    ❌ Mistral quiz error: {e} — using fallback")
        return get_fallback_quiz(simulation_result)


def get_fallback_quiz(simulation_result: dict) -> list:
    """
    Static fallback quiz when Mistral unavailable.
    Context-aware based on simulation params.
    """
    country_a  = simulation_result.get("country_a", "IND")
    country_b  = simulation_result.get("country_b", "PAK")
    shock_type = simulation_result.get("shock_type", "war")

    shock_labels = {
        "war":       "armed conflict",
        "sanctions": "economic sanctions",
        "supply":    "supply chain disruption"
    }
    shock_label = shock_labels.get(shock_type, "shock")

    return [
        {
            "domain":        "Energy domain",
            "question":      f"In the {country_a}-{country_b} {shock_label} simulation, which layer is affected FIRST in the cascade model?",
            "options":       ["Food layer", "Energy layer", "Trade layer", "Financial layer"],
            "correct_index": 1,
            "explanation":   "Energy is always the first layer hit in the cascade model because fuel and electricity disruptions happen immediately when conflict breaks out.",
            "xp":            75
        },
        {
            "domain":        "Trade domain",
            "question":      f"After energy is disrupted in the {country_a} simulation, which timestep does trade disruption typically peak?",
            "options":       ["t₀ — immediately", "t₁ — energy layer", "t₂ — trade layer", "t₄ — recovery"],
            "correct_index": 2,
            "explanation":   "Trade disruption peaks at t₂ because it takes time for energy shortages to translate into shipping and logistics failures.",
            "xp":            75
        },
        {
            "domain":        "Spillover Index",
            "question":      "A country with Spillover Index (SI) of 0.82 is classified as:",
            "options":       ["Low risk", "Moderate risk", "High risk", "Critical risk"],
            "correct_index": 3,
            "explanation":   "SI above 0.75 is classified as Critical — meaning the country is severely vulnerable to cross-domain cascade shocks.",
            "xp":            100
        },
        {
            "domain":        "Food domain",
            "question":      "Which region typically shows the highest food vulnerability SI during a Middle East conflict?",
            "options":       ["Western Europe", "North America", "North Africa and Middle East", "East Asia"],
            "correct_index": 2,
            "explanation":   "North Africa and Middle East countries like Egypt, Yemen and Lebanon have food import dependencies above 70%, making them highly vulnerable to any regional conflict.",
            "xp":            100
        },
        {
            "domain":        "Cascade Model",
            "question":      f"In a {shock_type} shock simulation, what does the decay rate between Energy→Trade layers represent?",
            "options":       [
                "How quickly oil prices fall",
                "The percentage of energy shock that transfers to trade disruption",
                "The number of countries affected",
                "GDP loss percentage"
            ],
            "correct_index": 1,
            "explanation":   "The decay rate (0.76 for Energy→Trade) represents that 76% of the energy shock intensity transfers to the trade layer, modeling how shocks weaken as they propagate through domains.",
            "xp":            125
        }
    ]