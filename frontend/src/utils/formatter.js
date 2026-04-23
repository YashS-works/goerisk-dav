// Format SI score
export function formatSI(val) {
    if (val === null || val === undefined) return '—'
    return parseFloat(val).toFixed(2)
}

// Format large numbers
export function formatNumber(val) {
    if (!val) return '0'
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B'
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K'
    return val.toString()
}

// Format percentage
export function formatPct(val) {
    if (val === null || val === undefined) return '—'
    return parseFloat(val).toFixed(1) + '%'
}

// Format shock type display
export function formatShock(shock) {
    const labels = {
        war: 'War / Conflict',
        sanctions: 'Sanctions',
        supply: 'Supply Disruption'
    }
    return labels[shock] || shock
}

// Format timestep
export function formatTimestep(t) {
    const labels = {
        0: 't₀ — Shock origin',
        1: 't₁ — Energy layer',
        2: 't₂ — Trade layer',
        3: 't₃ — Food layer'
    }
    return labels[t] || `t${t}`
}

// Format risk level
export function formatRisk(level) {
    const labels = {
        critical: 'Critical',
        high: 'High Risk',
        moderate: 'Moderate',
        low: 'Low',
        unknown: 'Unknown'
    }
    return labels[level] || level
}