import httpx
from dotenv import load_dotenv
import os

load_dotenv()

EIA_KEY  = os.getenv("EIA_KEY", "")
EIA_BASE = os.getenv("EIA_BASE", "https://api.eia.gov/v2")

async def fetch_energy_imports() -> dict:
    try:
        url    = f"{EIA_BASE}/crude-oil-imports/data/"
        params = {
            "api_key":            EIA_KEY,
            "frequency":          "monthly",
            "data[0]":            "quantity",
            "sort[0][column]":    "period",
            "sort[0][direction]": "desc",
            "offset":             0,
            "length":             5000
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("    → Fetching EIA crude oil imports...")
            response = await client.get(url, params=params)
            response.raise_for_status()
            raw = response.json()

        data = raw.get("response", {}).get("data", [])
        if not data:
            print("    ⚠ No EIA crude data — using fallback")
            return get_fallback_energy()

        imports_by_country = {}
        for row in data:
            country = row.get("originName", "")
            try:
                quantity = float(str(row.get("quantity") or 0).replace(",", ""))
            except (ValueError, TypeError):
                quantity = 0.0
            if country:
                imports_by_country[country] = \
                    imports_by_country.get(country, 0.0) + quantity

        total  = sum(imports_by_country.values())
        result = {}
        if total > 0:
            for country, qty in imports_by_country.items():
                result[country] = {
                    "quantity":  qty,
                    "share_pct": round((qty / total) * 100, 3)
                }

        print(f"    ✅ EIA crude imports: {len(result)} countries")
        return result if result else get_fallback_energy()

    except Exception as e:
        print(f"    ❌ EIA error: {e} — using fallback")
        return get_fallback_energy()


async def fetch_international_energy() -> dict:
    try:
        # Use correct string params for EIA v2
        url  = f"{EIA_BASE}/international/data/"
        params = {
            "api_key":   EIA_KEY,
            "frequency": "annual",
            "data[0]":   "value",
            "length":    300
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("    → Fetching EIA international energy...")
            response = await client.get(url, params=params)
            response.raise_for_status()
            raw = response.json()

        data   = raw.get("response", {}).get("data", [])
        result = {}

        for row in data:
            country = row.get("countryRegionName", "")
            code    = row.get("countryRegionCode", "")
            try:
                value = float(str(row.get("value") or 0).replace(",", ""))
            except (ValueError, TypeError):
                value = 0.0
            if country and code:
                result[code] = {"name": country, "value": value}

        if not result:
            print("    ⚠ EIA international empty — using fallback")
            return get_fallback_international()

        print(f"    ✅ EIA international: {len(result)} countries")
        return result

    except Exception as e:
        print(f"    ❌ EIA international error: {e} — using fallback")
        return get_fallback_international()


def get_fallback_energy() -> dict:
    """Static energy import data when EIA is unavailable."""
    return {
        "Saudi Arabia": {"quantity": 450000, "share_pct": 18.2},
        "Canada":       {"quantity": 380000, "share_pct": 15.4},
        "Russia":       {"quantity": 320000, "share_pct": 12.9},
        "Iraq":         {"quantity": 290000, "share_pct": 11.7},
        "Nigeria":      {"quantity": 210000, "share_pct": 8.5},
        "Mexico":       {"quantity": 190000, "share_pct": 7.7},
        "Colombia":     {"quantity": 160000, "share_pct": 6.5},
        "Ecuador":      {"quantity": 140000, "share_pct": 5.7},
        "Kuwait":       {"quantity": 120000, "share_pct": 4.9},
        "Libya":        {"quantity": 100000, "share_pct": 4.0},
        "Venezuela":    {"quantity": 90000,  "share_pct": 3.6},
        "Angola":       {"quantity": 85000,  "share_pct": 3.4},
        "Kazakhstan":   {"quantity": 75000,  "share_pct": 3.0},
        "Azerbaijan":   {"quantity": 65000,  "share_pct": 2.6},
        "Norway":       {"quantity": 55000,  "share_pct": 2.2},
        "UAE":          {"quantity": 50000,  "share_pct": 2.0},
        "Algeria":      {"quantity": 45000,  "share_pct": 1.8},
        "Iran":         {"quantity": 40000,  "share_pct": 1.6},
        "Qatar":        {"quantity": 35000,  "share_pct": 1.4},
        "Oman":         {"quantity": 30000,  "share_pct": 1.2},
    }


def get_fallback_international() -> dict:
    """Static international energy consumption fallback."""
    return {
        "USA": {"name": "United States", "value": 2300.0},
        "CHN": {"name": "China",         "value": 1450.0},
        "RUS": {"name": "Russia",        "value": 780.0},
        "IND": {"name": "India",         "value": 620.0},
        "JPN": {"name": "Japan",         "value": 480.0},
        "DEU": {"name": "Germany",       "value": 310.0},
        "KOR": {"name": "South Korea",   "value": 290.0},
        "CAN": {"name": "Canada",        "value": 270.0},
        "SAU": {"name": "Saudi Arabia",  "value": 260.0},
        "BRA": {"name": "Brazil",        "value": 240.0},
        "FRA": {"name": "France",        "value": 230.0},
        "GBR": {"name": "United Kingdom","value": 210.0},
        "MEX": {"name": "Mexico",        "value": 200.0},
        "IRN": {"name": "Iran",          "value": 190.0},
        "IDN": {"name": "Indonesia",     "value": 180.0},
        "AUS": {"name": "Australia",     "value": 170.0},
        "TUR": {"name": "Turkey",        "value": 160.0},
        "NGA": {"name": "Nigeria",       "value": 150.0},
        "ZAF": {"name": "South Africa",  "value": 140.0},
        "POL": {"name": "Poland",        "value": 130.0},
    }