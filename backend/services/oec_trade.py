import httpx
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()

OEC_BASE = os.getenv("OEC_BASE", "https://oec.world/api/v1/data")

OEC_COUNTRIES = [
    "ind", "pak", "chn", "deu", "rus", "egy", "usa",
    "ukr", "gbr", "fra", "jpn", "kor", "sau", "irn",
    "tur", "bra", "nga", "zaf", "mex", "arg", "idn",
    "bgd", "lka", "npl", "yem", "lbn", "tun", "mar",
    "pol", "hun", "ita", "esp", "nld", "bel", "swe",
    "nor", "fin", "dnk", "grc", "prt", "rou", "cze"
]

async def fetch_country_trade(iso3_lower: str) -> dict:
    try:
        url = f"{OEC_BASE}/country/{iso3_lower}/exports/country/"
        params = {"year": 2022}
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                return {}
            raw = response.json()
        data = raw.get("data", [])
        result = {}
        for row in data:
            partner = row.get("Partner Country", "")
            value   = row.get("Trade Value", 0) or 0
            if partner:
                result[partner] = float(value)
        return result
    except Exception:
        return {}


async def fetch_all_trade_data() -> dict:
    print("    → Fetching OEC trade data...")
    all_trade = {}
    for iso3 in OEC_COUNTRIES:
        try:
            data = await fetch_country_trade(iso3)
            all_trade[iso3.upper()] = {
                "exports":      data,
                "total_export": sum(data.values())
            }
            await asyncio.sleep(0.3)
        except Exception:
            all_trade[iso3.upper()] = {
                "exports":      {},
                "total_export": 0
            }
    print(f"    ✅ OEC trade data: {len(all_trade)} countries")
    return all_trade