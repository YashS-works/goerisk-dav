from fastapi import APIRouter, HTTPException
from services.si_calculator import (
    compute_all_countries_si,
    rank_countries_by_si
)
from services.network_analyzer import (
    build_graph,
    get_centrality,
    find_bottlenecks,
    detect_clusters,
    find_cascade_path,
    get_network_data_for_frontend
)
from utils.cache import DataCache

router  = APIRouter()
_cache: DataCache = None

def set_cache(cache: DataCache):
    global _cache
    _cache = cache


@router.get("/network")
def get_network(
    shock_type: str   = "war",
    intensity:  float = 0.7
):
    """
    Returns D3 force graph data for network visualization.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    G = build_graph(
        countries = _cache.countries,
        wb_data   = _cache.wb_data,
        si_scores = si_scores
    )

    network_data = get_network_data_for_frontend(
        G         = G,
        si_scores = si_scores,
        max_nodes = 60
    )

    return {
        "shock_type": shock_type,
        "intensity":  intensity,
        **network_data
    }


@router.get("/bottlenecks")
def get_bottlenecks(
    shock_type: str   = "war",
    intensity:  float = 0.7,
    top_n:      int   = 10
):
    """
    Returns top bottleneck countries in cascade network.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    G = build_graph(
        countries = _cache.countries,
        wb_data   = _cache.wb_data,
        si_scores = si_scores
    )

    bottlenecks = find_bottlenecks(
        G         = G,
        si_scores = si_scores,
        top_n     = top_n
    )

    return {
        "shock_type":  shock_type,
        "intensity":   intensity,
        "bottlenecks": bottlenecks
    }


@router.get("/clusters")
def get_clusters(
    shock_type: str   = "war",
    intensity:  float = 0.7,
    threshold:  float = 0.40
):
    """
    Returns vulnerability clusters.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    G = build_graph(
        countries = _cache.countries,
        wb_data   = _cache.wb_data,
        si_scores = si_scores
    )

    clusters = detect_clusters(
        G         = G,
        si_scores = si_scores,
        threshold = threshold
    )

    return {
        "shock_type": shock_type,
        "intensity":  intensity,
        "threshold":  threshold,
        "count":      len(clusters),
        "clusters":   clusters
    }


@router.get("/path/{origin}/{target}")
def get_path(
    origin:     str,
    target:     str,
    shock_type: str   = "war",
    intensity:  float = 0.7
):
    """
    Returns cascade path between two countries.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    G = build_graph(
        countries = _cache.countries,
        wb_data   = _cache.wb_data,
        si_scores = si_scores
    )

    path = find_cascade_path(
        G           = G,
        origin_code = origin.upper(),
        target_code = target.upper()
    )

    return {
        "origin":     origin.upper(),
        "target":     target.upper(),
        "shock_type": shock_type,
        **path
    }


@router.get("/trends")
def get_trends(
    shock_type: str   = "war",
    intensity:  float = 0.7
):
    """
    Returns SI trend data for charts.
    Simulates monthly progression.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    import random

    base_si = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    ranked = rank_countries_by_si(base_si)

    # Generate 12-month trend for top countries
    months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
    ]

    trends = []
    for country in ranked[:10]:
        base = country["composite_si"]
        monthly = []
        current = max(0, base - 0.3)
        for _ in months:
            current = min(1.0, current + random.uniform(0.01, 0.04))
            monthly.append(round(current, 3))

        trends.append({
            "country_code": country["country_code"],
            "monthly_si":   monthly,
            "final_si":     monthly[-1]
        })

    # Domain averages
    energy_avg = round(
        sum(b.get("energy_si", 0) for b in base_si.values()) /
        max(len(base_si), 1), 3
    )
    trade_avg  = round(
        sum(b.get("trade_si", 0) for b in base_si.values()) /
        max(len(base_si), 1), 3
    )
    food_avg   = round(
        sum(b.get("food_si", 0) for b in base_si.values()) /
        max(len(base_si), 1), 3
    )

    return {
        "months":      months,
        "trends":      trends,
        "domain_avgs": {
            "energy": energy_avg,
            "trade":  trade_avg,
            "food":   food_avg
        }
    }


@router.get("/summary")
def get_summary(
    shock_type: str   = "war",
    intensity:  float = 0.7
):
    """
    Returns full analytics summary.
    Used for analytics dashboard.
    """
    if not _cache or not _cache.is_ready:
        raise HTTPException(503, "Data not ready")

    si_scores = compute_all_countries_si(
        countries  = _cache.countries,
        wb_data    = _cache.wb_data,
        food_data  = _cache.food_data,
        shock_type = shock_type,
        intensity  = intensity
    )

    ranked = rank_countries_by_si(si_scores)

    critical  = [r for r in ranked if r["risk_level"] == "critical"]
    high      = [r for r in ranked if r["risk_level"] == "high"]
    moderate  = [r for r in ranked if r["risk_level"] == "moderate"]
    low       = [r for r in ranked if r["risk_level"] == "low"]

    return {
        "shock_type":   shock_type,
        "intensity":    intensity,
        "total":        len(ranked),
        "critical":     len(critical),
        "high":         len(high),
        "moderate":     len(moderate),
        "low":          len(low),
        "top_10":       ranked[:10],
        "bottom_10":    ranked[-10:],
        "avg_si":       round(
            sum(r["composite_si"] for r in ranked) /
            max(len(ranked), 1), 3
        ),
        "conflicts":    len(_cache.conflicts)
    }