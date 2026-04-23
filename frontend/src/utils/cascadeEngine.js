import { siToColor } from './colorScale'

// Extract all affected countries from cascade result
export function extractAffected(cascade) {
    if (!cascade) return []

    const all = {}

    const steps = ['t0', 't1', 't2', 't3']
    steps.forEach((step, i) => {
        const stepData = cascade[step] || {}
        Object.entries(stepData).forEach(([code, data]) => {
            if (!all[code] || data.composite_si > all[code].composite_si) {
                all[code] = {
                    ...data,
                    country_code: code,
                    timestep: i,
                    color: siToColor(data.composite_si)
                }
            }
        })
    })

    return Object.values(all).sort(
        (a, b) => b.composite_si - a.composite_si
    )
}

// Get countries at specific timestep
export function getAtTimestep(cascade, timestep) {
    if (!cascade) return {}
    const key = `t${timestep}`
    return cascade[key] || {}
}

// Get cascade summary stats
export function getCascadeSummary(cascade) {
    if (!cascade) return {}
    return cascade.summary || {}
}

// Get cascade path for animation
export function getCascadePath(cascade) {
    if (!cascade) return []
    return cascade.cascade_path || []
}