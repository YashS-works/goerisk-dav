from services.si_calculator import get_risk_level, get_risk_color

MIDDLE_EAST_ENERGY_EXPORTERS = {
    "IRN", "IRQ", "SAU", "ARE", "QAT", "KWT", "OMN"
}


def country_name(code: str, countries: dict) -> str:
    return countries.get(code, {}).get("name", code)


def partner_matches_code(partner_name: str, target_code: str, countries: dict) -> bool:
    partner_l = partner_name.lower()
    target_l = target_code.lower()
    target_name = country_name(target_code, countries).lower()
    return target_l in partner_l or (target_name and (target_name in partner_l or partner_l in target_name))


def bilateral_export_share(origin_code: str, target_code: str, countries: dict, trade_data: dict) -> float:
    origin_trade = trade_data.get(origin_code, {})
    exports = origin_trade.get("exports", {})
    total = origin_trade.get("total_export", 0) or 0
    if total <= 0:
        return 0.0
    for partner, value in exports.items():
        if partner_matches_code(partner, target_code, countries):
            return min(1.0, float(value or 0) / total)
    return 0.0


def derive_sectors(
    code: str,
    wb_data: dict,
    trade_data: dict,
    countries: dict,
    origins: list
) -> list:
    """Derive affected sectors from real World Bank + trade data for any country."""
    wb = wb_data.get(code, {})
    energy_pct = wb.get("energy_import_pct", 0) or 0
    food_pct   = wb.get("food_import_pct",   0) or 0
    trade_pct  = wb.get("trade_gdp_pct",     0) or 0

    sectors = []

    if energy_pct > 10:
        sectors.append("crude oil & energy imports")
    if energy_pct > 25:
        sectors.append("LPG / fuel prices")
    if energy_pct > 60:
        sectors.append("power generation")

    if food_pct > 15:
        sectors.append("food imports")
    if food_pct > 40:
        sectors.append("staple food prices")

    if trade_pct > 50:
        sectors.append("export trade routes")
    if trade_pct > 100:
        sectors.append("shipping & logistics")

    if any(o in MIDDLE_EAST_ENERGY_EXPORTERS for o in origins) and energy_pct > 10:
        sectors.extend(["shipping insurance", "fertilizer inputs"])

    for origin in origins:
        share = bilateral_export_share(origin, code, countries, trade_data)
        if share > 0.02:
            sectors.append(f"direct trade with {country_name(origin, countries)}")

    seen = set()
    unique = []
    for s in sectors:
        if s not in seen:
            seen.add(s)
            unique.append(s)

    return unique[:6] or ["general economic exposure"]


def derive_household_impact(code: str, wb_data: dict, origins: list) -> str:
    """Derive household impact description from real data for any country."""
    wb = wb_data.get(code, {})
    energy_pct = wb.get("energy_import_pct", 0) or 0
    food_pct   = wb.get("food_import_pct",   0) or 0
    trade_pct  = wb.get("trade_gdp_pct",     0) or 0
    middle_east = any(o in MIDDLE_EAST_ENERGY_EXPORTERS for o in origins)

    parts = []
    if energy_pct > 10:
        parts.append(
            f"higher fuel and energy costs ({energy_pct:.0f}% energy import dependency)"
        )
    if food_pct > 20:
        parts.append(
            f"food price inflation ({food_pct:.0f}% food import dependency)"
        )
    if middle_east and energy_pct > 10:
        parts.append("LPG/cylinder and transport cost pass-through from oil corridor disruption")
    if trade_pct > 80:
        parts.append(f"disrupted export income (trade is {trade_pct:.0f}% of GDP)")

    if parts:
        return "Households may face " + ", ".join(parts) + "."
    return "Indirect exposure through trade and supply chain channels where this shock propagates."


def scenario_exposure_boost(
    target_code: str,
    origin_a:    str,
    origin_b:    str,
    countries:   dict,
    trade_data:  dict,
    wb_data:     dict,
    shock_type:  str,
    intensity:   float
) -> dict:
    channels = []
    score    = 0.0
    origins  = [origin_a, origin_b]

    for origin in origins:
        share = bilateral_export_share(origin, target_code, countries, trade_data)
        if share > 0:
            score += min(0.28, share * 0.9) * intensity
            channels.append({
                "type":   "direct_trade",
                "source": origin,
                "label":  f"Direct trade exposure to {country_name(origin, countries)}",
                "weight": round(share, 4)
            })

    # Use real energy import % from World Bank instead of hardcoded dict
    if any(o in MIDDLE_EAST_ENERGY_EXPORTERS for o in origins):
        energy_import_pct = (wb_data.get(target_code, {}).get("energy_import_pct", 0) or 0)
        exposure = energy_import_pct / 100.0
        if exposure > 0.05:
            multiplier = 1.15 if shock_type == "war" else 0.9
            score += exposure * intensity * multiplier
            channels.append({
                "type":   "energy_import",
                "source": "Middle East energy corridor",
                "label":  f"Oil/LNG import and shipping-route exposure ({energy_import_pct:.0f}% energy imported)",
                "weight": round(exposure, 3)
            })

    # South / South-East Asia fuel pass-through when Middle East is involved
    if target_code in {"IND", "PAK", "BGD", "LKA", "MMR", "VNM", "PHL", "THA"} \
            and any(o in MIDDLE_EAST_ENERGY_EXPORTERS for o in origins):
        score += 0.08 * intensity
        channels.append({
            "type":   "household_inflation",
            "source": "Fuel-price pass-through",
            "label":  "LPG/cylinder, transport, fertilizer, and food-price pass-through",
            "weight": 0.08
        })

    return {
        "boost":    round(min(0.55, score), 3),
        "channels": channels
    }


def build_country_impacts(
    cascade:    dict,
    countries:  dict,
    trade_data: dict,
    wb_data:    dict,
    origin_a:   str,
    origin_b:   str,
    shock_type: str,
    intensity:  float
) -> list:
    by_code = {}
    origins = [origin_a, origin_b]

    for step in ("t0", "t1", "t2", "t3"):
        for code, data in cascade.get(step, {}).items():
            current = by_code.get(code, {})
            by_code[code] = {
                **current,
                **data,
                "country_code":      code,
                "name":              country_name(code, countries),
                "timestep":          min(
                    current.get("timestep", data.get("timestep", 0)),
                    data.get("timestep", 0)
                ) if current else data.get("timestep", 0),
                "cascade_layer":     step,
                "base_composite_si": max(
                    current.get("base_composite_si", 0),
                    data.get("composite_si", 0)
                ),
                "energy_si": max(current.get("energy_si", 0), data.get("energy_si", 0)),
                "trade_si":  max(current.get("trade_si",  0), data.get("trade_si",  0)),
                "food_si":   max(current.get("food_si",   0), data.get("food_si",   0)),
            }

    # Always include origin countries + IND / PAK (app focus)
    for required in list({origin_a, origin_b, "IND", "PAK"}):
        if required in countries and required not in by_code:
            by_code[required] = {
                "country_code":      required,
                "name":              country_name(required, countries),
                "timestep":          1,
                "cascade_layer":     "exposure",
                "base_composite_si": 0,
                "energy_si":         0,
                "trade_si":          0,
                "food_si":           0,
                "affected_by":       "scenario"
            }

    impacts = []
    for code, data in by_code.items():
        exposure  = scenario_exposure_boost(
            code, origin_a, origin_b,
            countries, trade_data, wb_data,
            shock_type, intensity
        )
        composite = round(min(1.0, data.get("base_composite_si", 0) + exposure["boost"]), 3)

        dominant = max(
            [
                ("energy", data.get("energy_si", 0) + sum(
                    c["weight"] for c in exposure["channels"] if c["type"] == "energy_import"
                )),
                ("trade",  data.get("trade_si",  0) + sum(
                    c["weight"] for c in exposure["channels"] if c["type"] == "direct_trade"
                )),
                ("food",   data.get("food_si",   0) + sum(
                    c["weight"] for c in exposure["channels"] if c["type"] == "household_inflation"
                )),
            ],
            key=lambda item: item[1]
        )[0]

        # Derived dynamically from real World Bank + trade data
        sectors   = derive_sectors(code, wb_data, trade_data, countries, origins)
        household = derive_household_impact(code, wb_data, origins)
        is_focus  = code in {origin_a, origin_b, "IND", "PAK"}

        impact = {
            **data,
            "composite_si":      composite,
            "scenario_boost":    exposure["boost"],
            "risk_level":        get_risk_level(composite),
            "risk_color":        get_risk_color(composite),
            "dominant_channel":  dominant,
            "exposure_channels": exposure["channels"],
            "focus_country":     is_focus,
            "affected_sectors":  sectors,
            "household_impact":  household
        }
        impacts.append(impact)

    impacts.sort(
        key=lambda i: (i.get("focus_country", False), i.get("composite_si", 0)),
        reverse=True
    )
    return impacts


def apply_country_impacts_to_cascade(
    cascade:         dict,
    country_impacts: list,
    countries:       dict
) -> dict:
    present = set()
    for step in ("t0", "t1", "t2", "t3"):
        present.update(cascade.get(step, {}).keys())

    for impact in country_impacts:
        code = impact.get("country_code")
        if not code or impact.get("scenario_boost", 0) <= 0:
            continue

        if code in present:
            for step in ("t0", "t1", "t2", "t3"):
                if code in cascade.get(step, {}):
                    existing = cascade[step][code]
                    if impact.get("composite_si", 0) > existing.get("composite_si", 0):
                        cascade[step][code] = {**existing, **impact}
                    break
            continue

        channels = impact.get("exposure_channels") or [{}]
        cascade.setdefault("t1", {})[code] = {
            **impact,
            "timestep": 1,
            "hop":      1,
            "from":     channels[0].get("source", cascade.get("origin", "")),
            "channel":  "scenario_exposure"
        }
        cascade.setdefault("cascade_path", []).append({
            "step":       "t1",
            "country":    code,
            "name":       country_name(code, countries),
            "si":         impact.get("composite_si", 0),
            "domain":     impact.get("dominant_channel", "energy"),
            "source":     impact.get("affected_by", "scenario"),
            "affected_by": impact.get("affected_by", "scenario")
        })
        present.add(code)

    all_affected = {
        **cascade.get("t0", {}),
        **cascade.get("t1", {}),
        **cascade.get("t2", {}),
        **cascade.get("t3", {})
    }
    critical = []
    for code, data in all_affected.items():
        if data.get("composite_si", 0) >= 0.50:
            critical.append({
                "country_code": code,
                "name":         country_name(code, countries),
                "composite_si": data.get("composite_si", 0),
                "energy_si":    data.get("energy_si",    0),
                "trade_si":     data.get("trade_si",     0),
                "food_si":      data.get("food_si",      0),
                "risk_level":   data.get("risk_level",   get_risk_level(data.get("composite_si", 0))),
                "timestep":     data.get("timestep",     0),
                "affected_by":  data.get("affected_by",  "scenario")
            })
    critical.sort(key=lambda i: i["composite_si"], reverse=True)

    cascade["total_affected"]     = len(all_affected)
    cascade["critical_countries"] = critical[:10]
    cascade["summary"] = {
        "t0_count": len(cascade.get("t0", {})),
        "t1_count": len(cascade.get("t1", {})),
        "t2_count": len(cascade.get("t2", {})),
        "t3_count": len(cascade.get("t3", {})),
        "total":    len(all_affected),
        "critical": len(critical),
        "max_si":   max(
            (d.get("composite_si", 0) for d in all_affected.values()),
            default=0
        ),
        "avg_si":   round(
            sum(d.get("composite_si", 0) for d in all_affected.values()) /
            max(len(all_affected), 1),
            3
        )
    }

    return cascade
