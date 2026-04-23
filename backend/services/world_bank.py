import httpx
from dotenv import load_dotenv
import os

load_dotenv()

WORLD_BANK_BASE = os.getenv("WORLD_BANK_BASE", "https://api.worldbank.org/v2")

INDICATORS = {
    "energy_import": "EG.IMP.CONS.ZS",
    "food_import":   "TM.VAL.FOOD.ZS.UN",
    "trade_gdp":     "NE.TRD.GNFS.ZS",
    "gdp":           "NY.GDP.MKTP.CD"
}

async def fetch_indicator(indicator_code: str) -> dict:
    """
    Fetches a single World Bank indicator for all countries.
    Returns dict keyed by country ISO2 code.
    """
    try:
        url = f"{WORLD_BANK_BASE}/country/all/indicator/{indicator_code}"
        params = {
            "format":   "json",
            "per_page": 300,
            "mrv":      1
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            print(f"    → Fetching indicator {indicator_code}...")
            response = await client.get(url, params=params)
            response.raise_for_status()
            raw = response.json()

        # World Bank returns [metadata, data]
        if not raw or len(raw) < 2:
            print(f"    ❌ No data for {indicator_code}")
            return {}

        data = raw[1]
        if not data:
            return {}

        # Process into clean dict
        result = {}
        for item in data:
            if not item:
                continue
            country = item.get("country", {})
            code    = item.get("countryiso3code", "")
            value   = item.get("value")

            if code and value is not None:
                result[code] = {
                    "country_name": country.get("value", ""),
                    "iso3":         code,
                    "value":        float(value),
                    "year":         item.get("date", "")
                }

        print(f"    ✅ Got {len(result)} countries for {indicator_code}")
        return result

    except httpx.HTTPError as e:
        print(f"    ❌ World Bank HTTP error: {e}")
        return {}
    except Exception as e:
        print(f"    ❌ World Bank error: {e}")
        return {}


async def fetch_all_indicators() -> dict:
    """
    Fetches all 4 indicators needed for SI calculation.
    Returns combined dict per country.
    """
    import asyncio

    print("    → Fetching all World Bank indicators...")

    # Fetch all 4 in parallel
    results = await asyncio.gather(
        fetch_indicator(INDICATORS["energy_import"]),
        fetch_indicator(INDICATORS["food_import"]),
        fetch_indicator(INDICATORS["trade_gdp"]),
        fetch_indicator(INDICATORS["gdp"])
    )

    energy_data, food_data, trade_data, gdp_data = results

    # Merge into single dict per country
    all_codes = set(energy_data) | set(food_data) | set(trade_data)
    combined  = {}

    for code in all_codes:
        combined[code] = {
            "iso3":              code,
            "energy_import_pct": energy_data.get(code, {}).get("value", 0.0),
            "food_import_pct":   food_data.get(code, {}).get("value", 0.0),
            "trade_gdp_pct":     trade_data.get(code, {}).get("value", 0.0),
            "gdp_usd":           gdp_data.get(code, {}).get("value", 0.0)
        }

    print(f"    ✅ World Bank data ready for {len(combined)} countries")
    return combined