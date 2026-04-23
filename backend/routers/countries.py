from fastapi import APIRouter, HTTPException
from utils.cache import DataCache
from services.si_calculator import (
    compute_all_countries_si,
    compute_bilateral_si,
    rank_countries_by_si
)

router = APIRouter()

# Reference to main cache
# This gets set in main.py
_cache: DataCache = None

def set_cache(cache: DataCache):
    global _cache
    _cache = cache


@router.get("/all")
def get_all_countries():
    """Returns all countries with metadata."""
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready yet")

    result = []
    for code, country in _cache.countries.items():
        result.append({
            "cca3":      code,
            "cca2":      country.get("cca2", ""),
            "name":      country.get("name", ""),
            "lat":       country.get("lat", 0),
            "lon":       country.get("lon", 0),
            "region":    country.get("region", ""),
            "borders":   country.get("borders", []),
            "population": country.get("population", 0)
        })

    return {
        "count":     len(result),
        "countries": result
    }


@router.get("/si/all")
def get_all_si(
    shock_type: str   = "war",
    intensity:  float = 0.7
):
    """
    Returns SI scores for ALL countries.
    Used to color the world map heatmap.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready yet")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    ranked = rank_countries_by_si(si_scores)

    return {
        "shock_type": shock_type,
        "intensity":  intensity,
        "count":      len(ranked),
        "countries":  ranked
    }


@router.get("/si/{country_code}")
def get_country_si(
    country_code: str,
    shock_type:   str   = "war",
    intensity:    float = 0.7
):
    """
    Returns full SI profile for a single country.
    Called when user clicks a country on the map.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready yet")

    code = country_code.upper()

    if code not in _cache.countries:
        raise HTTPException(404, f"Country {code} not found")

    country = _cache.countries[code]

    # Compute SI for this country
    from services.si_calculator import compute_si
    si = compute_si(
        country_code = code,
        wb_data      = _cache.wb_data,
        food_data    = _cache.food_data,
        shock_type   = shock_type,
        intensity    = intensity
    )

    # Get neighbours SI
    neighbours     = country.get("borders", [])
    neighbour_si   = {}
    for n_code in neighbours[:10]:
        if n_code in _cache.countries:
            n_si = compute_si(
                country_code = n_code,
                wb_data      = _cache.wb_data,
                food_data    = _cache.food_data,
                shock_type   = shock_type,
                intensity    = intensity * 0.8
            )
            neighbour_si[n_code] = {
                "name":         _cache.countries[n_code]["name"],
                "composite_si": n_si["composite_si"],
                "risk_level":   n_si["risk_level"]
            }

    # Get conflict events for this country
    country_name = country.get("name", "")
    conflicts    = [
        c for c in _cache.conflicts
        if c.get("country", "").lower() == country_name.lower()
    ]

    return {
        "country": {
            "cca3":       code,
            "name":       country_name,
            "lat":        country.get("lat", 0),
            "lon":        country.get("lon", 0),
            "region":     country.get("region", ""),
            "population": country.get("population", 0),
            "borders":    neighbours
        },
        "si":           si,
        "neighbours":   neighbour_si,
        "conflicts":    conflicts,
        "wb_raw": {
            "energy_import_pct": _cache.wb_data.get(code, {}).get("energy_import_pct", 0),
            "food_import_pct":   _cache.wb_data.get(code, {}).get("food_import_pct",   0),
            "trade_gdp_pct":     _cache.wb_data.get(code, {}).get("trade_gdp_pct",     0),
            "gdp_usd":           _cache.wb_data.get(code, {}).get("gdp_usd",           0)
        }
    }


@router.get("/conflicts")
def get_conflicts():
    """Returns all conflict events."""
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    return {
        "count":     len(_cache.conflicts),
        "conflicts": _cache.conflicts
    }