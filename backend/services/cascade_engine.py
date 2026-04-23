from services.si_calculator import (
    compute_si,
    get_risk_level,
    get_risk_color
)

# How much SI decays as it moves between layers
DECAY_RATES = {
    "energy_to_trade": 0.76,
    "trade_to_food":   0.64,
}

# How many hops the shock travels per timestep
MAX_HOPS = {
    "war":       4,
    "sanctions": 3,
    "supply":    2
}


def run_cascade(
    origin_code: str,
    all_countries: dict,
    wb_data:       dict,
    food_data:     dict,
    trade_data:    dict,
    shock_type:    str   = "war",
    intensity:     float = 0.7
) -> dict:
    """
    Runs full t0→t3 cascade simulation.

    t0 → Shock fires at origin country
    t1 → Energy layer affected (direct neighbours)
    t2 → Trade layer cascades (neighbours of neighbours)
    t3 → Food layer cascades (full network impact)

    Returns SI scores at each timestep for every
    affected country.
    """

    results = {
        "origin":     origin_code,
        "shock_type": shock_type,
        "intensity":  intensity,
        "t0": {},
        "t1": {},
        "t2": {},
        "t3": {},
        "cascade_path":    [],
        "total_affected":  0,
        "critical_countries": [],
        "summary": {}
    }

    # ── T0 — Shock origin ──────────────────────────
    origin_si = compute_si(
        country_code = origin_code,
        wb_data      = wb_data,
        food_data    = food_data,
        shock_type   = shock_type,
        intensity    = intensity
    )

    results["t0"][origin_code] = {
        **origin_si,
        "timestep": 0,
        "hop":      0
    }

    results["cascade_path"].append({
        "step":    "t0",
        "country": origin_code,
        "name":    all_countries.get(origin_code, {}).get("name", origin_code),
        "si":      origin_si["composite_si"],
        "domain":  "origin"
    })

    # ── T1 — Energy layer: direct neighbours ───────
    origin_borders = all_countries.get(
        origin_code, {}
    ).get("borders", [])

    t1_intensity = intensity * DECAY_RATES["energy_to_trade"]

    for neighbour_code in origin_borders:
        if neighbour_code not in all_countries:
            continue

        n_si = compute_si(
            country_code = neighbour_code,
            wb_data      = wb_data,
            food_data    = food_data,
            shock_type   = shock_type,
            intensity    = t1_intensity
        )

        results["t1"][neighbour_code] = {
            **n_si,
            "timestep": 1,
            "hop":      1,
            "from":     origin_code
        }

        results["cascade_path"].append({
            "step":    "t1",
            "country": neighbour_code,
            "name":    all_countries[neighbour_code].get("name", ""),
            "si":      n_si["composite_si"],
            "domain":  "energy"
        })

    # ── T2 — Trade layer: second degree ────────────
    t2_intensity = t1_intensity * DECAY_RATES["energy_to_trade"]
    t1_countries = set(results["t1"].keys())

    for t1_code in list(t1_countries):
        t1_borders = all_countries.get(
            t1_code, {}
        ).get("borders", [])

        for neighbour_code in t1_borders:
            if neighbour_code not in all_countries:
                continue
            if neighbour_code in results["t0"]:
                continue
            if neighbour_code in results["t1"]:
                continue

            n_si = compute_si(
                country_code = neighbour_code,
                wb_data      = wb_data,
                food_data    = food_data,
                shock_type   = shock_type,
                intensity    = t2_intensity
            )

            # Only add if not already in t2
            # or if new SI is higher
            existing = results["t2"].get(neighbour_code)
            if not existing or \
               n_si["composite_si"] > existing["composite_si"]:
                results["t2"][neighbour_code] = {
                    **n_si,
                    "timestep": 2,
                    "hop":      2,
                    "from":     t1_code
                }

    for code, data in results["t2"].items():
        results["cascade_path"].append({
            "step":    "t2",
            "country": code,
            "name":    all_countries.get(code, {}).get("name", ""),
            "si":      data["composite_si"],
            "domain":  "trade"
        })

    # ── T3 — Food layer: third degree ──────────────
    t3_intensity = t2_intensity * DECAY_RATES["trade_to_food"]
    t2_countries = set(results["t2"].keys())

    for t2_code in list(t2_countries):
        t2_borders = all_countries.get(
            t2_code, {}
        ).get("borders", [])

        for neighbour_code in t2_borders:
            if neighbour_code not in all_countries:
                continue
            if neighbour_code in results["t0"]:
                continue
            if neighbour_code in results["t1"]:
                continue
            if neighbour_code in results["t2"]:
                continue

            n_si = compute_si(
                country_code = neighbour_code,
                wb_data      = wb_data,
                food_data    = food_data,
                shock_type   = shock_type,
                intensity    = t3_intensity
            )

            existing = results["t3"].get(neighbour_code)
            if not existing or \
               n_si["composite_si"] > existing["composite_si"]:
                results["t3"][neighbour_code] = {
                    **n_si,
                    "timestep": 3,
                    "hop":      3,
                    "from":     t2_code
                }

    for code, data in results["t3"].items():
        results["cascade_path"].append({
            "step":    "t3",
            "country": code,
            "name":    all_countries.get(code, {}).get("name", ""),
            "si":      data["composite_si"],
            "domain":  "food"
        })

    # ── Summary ─────────────────────────────────────
    all_affected = {
        **results["t0"],
        **results["t1"],
        **results["t2"],
        **results["t3"]
    }

    critical = [
        {
            "country_code": code,
            "name": all_countries.get(code, {}).get("name", code),
            "composite_si": data["composite_si"],
            "risk_level":   data["risk_level"],
            "timestep":     data["timestep"]
        }
        for code, data in all_affected.items()
        if data["composite_si"] >= 0.50
    ]

    critical.sort(
        key=lambda x: x["composite_si"],
        reverse=True
    )

    results["total_affected"]     = len(all_affected)
    results["critical_countries"] = critical[:10]

    results["summary"] = {
        "t0_count":   len(results["t0"]),
        "t1_count":   len(results["t1"]),
        "t2_count":   len(results["t2"]),
        "t3_count":   len(results["t3"]),
        "total":      len(all_affected),
        "critical":   len(critical),
        "max_si":     max(
            (d["composite_si"] for d in all_affected.values()),
            default=0
        ),
        "avg_si":     round(
            sum(d["composite_si"] for d in all_affected.values()) /
            max(len(all_affected), 1),
            3
        )
    }

    return results


def get_timestep_data(
    cascade_result: dict,
    timestep: int
) -> dict:
    """
    Returns SI data for a specific timestep.
    Used by timeline scrubber on frontend.
    """
    step_key = f"t{timestep}"
    data     = cascade_result.get(step_key, {})

    return {
        "timestep":  timestep,
        "countries": [
            {
                "country_code": code,
                "composite_si": info["composite_si"],
                "energy_si":    info["energy_si"],
                "trade_si":     info["trade_si"],
                "food_si":      info["food_si"],
                "risk_level":   info["risk_level"],
                "risk_color":   info["risk_color"]
            }
            for code, info in data.items()
        ],
        "count": len(data)
    }