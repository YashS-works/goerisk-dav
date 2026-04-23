import httpx
from dotenv import load_dotenv
import os

load_dotenv()

REST_COUNTRIES_BASE = os.getenv("REST_COUNTRIES_BASE", "https://restcountries.com/v3.1")

async def fetch_all_countries() -> dict:
    """
    Fetches all 192 countries with:
    - Name
    - ISO codes (cca2, cca3)
    - Coordinates (lat/lon)
    - Region and subregion
    - Population
    - Bordering countries
    """
    try:
        url = f"{REST_COUNTRIES_BASE}/all"
        params = {
            "fields": "name,cca2,cca3,latlng,region,subregion,population,borders,flag"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            print("    → Calling REST Countries API...")
            response = await client.get(url, params=params)
            response.raise_for_status()
            raw_data = response.json()

        # Process into clean dict keyed by cca3 code
        countries = {}
        for c in raw_data:
            cca3 = c.get("cca3", "")
            if not cca3:
                continue

            latlng = c.get("latlng", [0, 0])
            countries[cca3] = {
                "cca3":       cca3,
                "cca2":       c.get("cca2", ""),
                "name":       c.get("name", {}).get("common", ""),
                "official":   c.get("name", {}).get("official", ""),
                "lat":        latlng[0] if len(latlng) > 0 else 0,
                "lon":        latlng[1] if len(latlng) > 1 else 0,
                "region":     c.get("region", ""),
                "subregion":  c.get("subregion", ""),
                "population": c.get("population", 0),
                "borders":    c.get("borders", []),
                "flag":       c.get("flag", ""),
                # SI scores — will be filled later
                "energy_si":  0.0,
                "trade_si":   0.0,
                "food_si":    0.0,
                "composite_si": 0.0,
                "risk_level": "unknown"
            }

        print(f"    ✅ Loaded {len(countries)} countries")
        return countries

    except httpx.HTTPError as e:
        print(f"    ❌ REST Countries HTTP error: {e}")
        return {}
    except Exception as e:
        print(f"    ❌ REST Countries error: {e}")
        return {}


async def get_country_neighbours(cca3: str, all_countries: dict) -> list:
    """
    Returns full neighbour data for a specific country.
    Used for cascade propagation.
    """
    country = all_countries.get(cca3, {})
    border_codes = country.get("borders", [])

    neighbours = []
    for code in border_codes:
        if code in all_countries:
            neighbours.append({
                "cca3":   code,
                "name":   all_countries[code]["name"],
                "lat":    all_countries[code]["lat"],
                "lon":    all_countries[code]["lon"],
                "region": all_countries[code]["region"]
            })

    return neighbours