import asyncio
import httpx
import json
import os

async def fetch_and_save():
    url = "https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json"
    print(f"Fetching from: {url}")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.get(url)
        print(f"Status: {r.status_code}")
        data = r.json()
        if not isinstance(data, list):
            print(f"Unexpected response type: {type(data)}")
            return

        print(f"Got {len(data)} countries")
        print(f"First item keys: {list(data[0].keys())}")

        # Transform to the same format our app expects (restcountries v3.1 format)
        countries = {}
        for c in data:
            cca3 = c.get("cca3", "")
            if not cca3:
                continue
            latlng = c.get("latlng", [0, 0])
            name_obj = c.get("name", {})
            # mledoze format has "common" and "official" directly
            common = name_obj.get("common", "")
            official = name_obj.get("official", "")
            cca2 = c.get("cca2", "")
            # Compute flag emoji from cca2
            flag = ""
            if len(cca2) == 2:
                flag = chr(0x1F1E6 + ord(cca2[0]) - ord('A')) + chr(0x1F1E6 + ord(cca2[1]) - ord('A'))

            countries[cca3] = {
                "cca3":       cca3,
                "cca2":       cca2,
                "name":       common,
                "official":   official,
                "lat":        latlng[0] if len(latlng) > 0 else 0,
                "lon":        latlng[1] if len(latlng) > 1 else 0,
                "region":     c.get("region", ""),
                "subregion":  c.get("subregion", ""),
                "population": c.get("population", 0),
                "borders":    c.get("borders", []),
                "flag":       flag,
                "energy_si":  0.0,
                "trade_si":   0.0,
                "food_si":    0.0,
                "composite_si": 0.0,
                "risk_level": "unknown"
            }

        out_path = os.path.join(os.path.dirname(__file__), "data", "countries.json")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(countries, f, ensure_ascii=False)
        print(f"Saved {len(countries)} countries to {out_path}")

asyncio.run(fetch_and_save())
