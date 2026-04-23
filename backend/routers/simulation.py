from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.cascade_engine import run_cascade, get_timestep_data
from services.si_calculator import compute_all_countries_si, rank_countries_by_si
from utils.cache import DataCache

router = APIRouter()

_cache: DataCache = None

def set_cache(cache: DataCache):
    global _cache
    _cache = cache


class SimulationRequest(BaseModel):
    country_a:  str
    country_b:  str
    shock_type: str   = "war"
    intensity:  float = 0.7
    domain:     str   = "energy"


@router.post("/run")
async def run_simulation(req: SimulationRequest):
    """
    Runs full cascade simulation.
    Called when user clicks Fire Shock on frontend.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    code_a = req.country_a.upper()
    code_b = req.country_b.upper()

    if code_a not in _cache.countries:
        raise HTTPException(404, f"Country A '{code_a}' not found")
    if code_b not in _cache.countries:
        raise HTTPException(404, f"Country B '{code_b}' not found")

    # Run cascade from country A
    cascade = run_cascade(
        origin_code   = code_a,
        all_countries = _cache.countries,
        wb_data       = _cache.wb_data,
        food_data     = _cache.food_data,
        trade_data    = _cache.trade_data,
        shock_type    = req.shock_type,
        intensity     = req.intensity
    )

    # Also compute SI for country B specifically
    from services.si_calculator import compute_si
    si_b = compute_si(
        country_code = code_b,
        wb_data      = _cache.wb_data,
        food_data    = _cache.food_data,
        shock_type   = req.shock_type,
        intensity    = req.intensity
    )

    # Global SI for map heatmap
    global_si = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = req.shock_type,
        intensity  = req.intensity
    )

    ranked = rank_countries_by_si(global_si)

    return {
        "status":      "success",
        "country_a":   code_a,
        "country_b":   code_b,
        "shock_type":  req.shock_type,
        "intensity":   req.intensity,
        "cascade":     cascade,
        "country_b_si": si_b,
        "global_si":   ranked[:50],
        "conflicts":   _cache.conflicts
    }


@router.get("/timestep/{country_code}/{timestep}")
def get_timestep(
    country_code: str,
    timestep:     int,
    shock_type:   str   = "war",
    intensity:    float = 0.7
):
    """
    Returns SI data for specific timestep.
    Used by timeline scrubber.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    code = country_code.upper()
    if code not in _cache.countries:
        raise HTTPException(404, f"Country {code} not found")

    cascade = run_cascade(
        origin_code   = code,
        all_countries = _cache.countries,
        wb_data       = _cache.wb_data,
        food_data     = _cache.food_data,
        trade_data    = _cache.trade_data,
        shock_type    = shock_type,
        intensity     = intensity
    )

    return get_timestep_data(cascade, timestep)


@router.get("/country/{country_code}")
def get_country_profile(
    country_code: str,
    shock_type:   str   = "war",
    intensity:    float = 0.7
):
    """
    Full profile when user clicks a country.
    Returns SI vs all 192 countries.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    code = country_code.upper()
    if code not in _cache.countries:
        raise HTTPException(404, f"Country {code} not found")

    cascade = run_cascade(
        origin_code   = code,
        all_countries = _cache.countries,
        wb_data       = _cache.wb_data,
        food_data     = _cache.food_data,
        trade_data    = _cache.trade_data,
        shock_type    = shock_type,
        intensity     = intensity
    )

    country_info = _cache.countries[code]
    conflicts    = [
        c for c in _cache.conflicts
        if c.get("country", "").lower() == country_info.get("name", "").lower()
    ]

    return {
        "country":      country_info,
        "cascade":      cascade,
        "conflicts":    conflicts,
        "wb_data":      _cache.wb_data.get(code, {})
    }