// SI score → color mapping
export function siToColor(si) {
    if (si >= 0.75) return '#dc2626'  // critical — red
    if (si >= 0.50) return '#d97706'  // high — amber
    if (si >= 0.25) return '#f97316'  // moderate — orange
    if (si > 0) return '#16a34a'  // low — green
    return '#94a3b8'                  // unknown — gray
}

// SI → risk label
export function siToRisk(si) {
    if (si >= 0.75) return 'Critical'
    if (si >= 0.50) return 'High'
    if (si >= 0.25) return 'Moderate'
    if (si > 0) return 'Low'
    return 'Unknown'
}

// SI → background color (light version)
export function siToBg(si) {
    if (si >= 0.75) return '#fee2e2'
    if (si >= 0.50) return '#fef3c7'
    if (si >= 0.25) return '#fff7ed'
    if (si > 0) return '#dcfce7'
    return '#f1f5f9'
}

// SI → opacity for map overlay
export function siToOpacity(si) {
    return Math.max(0.1, Math.min(0.85, si))
}

// Domain color
export function domainColor(domain) {
    const colors = {
        energy: '#2563eb',
        trade: '#16a34a',
        food: '#d97706',
        all: '#7c3aed'
    }
    return colors[domain] || '#94a3b8'
}