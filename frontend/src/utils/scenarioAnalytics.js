const STEPS = ['t0', 't1', 't2', 't3']

export function flattenScenarioCountries(result) {
  if (result?.country_impacts?.length) {
    return [...result.country_impacts].sort((a, b) => (b.composite_si || 0) - (a.composite_si || 0))
  }

  const cascade = result?.cascade
  if (!cascade) return []

  const byCode = new Map()

  STEPS.forEach(step => {
    Object.entries(cascade[step] || {}).forEach(([code, data]) => {
      const existing = byCode.get(code) || {}
      const composite = Math.max(existing.composite_si || 0, data.composite_si || 0)
      byCode.set(code, {
        ...existing,
        ...data,
        country_code: code,
        name: data.name || existing.name || code,
        composite_si: composite,
        energy_si: Math.max(existing.energy_si || 0, data.energy_si || 0),
        trade_si: Math.max(existing.trade_si || 0, data.trade_si || 0),
        food_si: Math.max(existing.food_si || 0, data.food_si || 0),
        timestep: Math.min(existing.timestep ?? data.timestep ?? 0, data.timestep ?? 0),
        affected_by: data.affected_by || existing.affected_by || 'scenario',
        risk_level: data.risk_level || existing.risk_level || 'unknown',
        risk_color: data.risk_color || existing.risk_color || '#94a3b8'
      })
    })
  })

  return [...byCode.values()].sort((a, b) => (b.composite_si || 0) - (a.composite_si || 0))
}

export function topScenarioCountriesByDomain(result, limit = 4) {
  const countries = flattenScenarioCountries(result)
  const seen = new Set()
  const pick = (key) => countries
    .filter(c => (c[key] || 0) > 0)
    .sort((a, b) => (b[key] || 0) - (a[key] || 0))
    .slice(0, limit)
    .map(c => {
      seen.add(c.country_code)
      return { ...c, domain_score: c[key] || 0 }
    })

  const byDomain = {
    energy: pick('energy_si'),
    trade: pick('trade_si'),
    food: pick('food_si')
  }

  return {
    byDomain,
    combined: countries
      .filter(c => seen.has(c.country_code))
      .sort((a, b) => (b.composite_si || 0) - (a.composite_si || 0))
  }
}

export function summarizeScenario(result) {
  const countries = flattenScenarioCountries(result)
  const n = Math.max(countries.length, 1)
  const avg = key => countries.reduce((sum, c) => sum + (c[key] || 0), 0) / n

  return {
    total: countries.length,
    critical: countries.filter(c => (c.composite_si || 0) >= 0.75).length,
    high: countries.filter(c => (c.composite_si || 0) >= 0.5 && (c.composite_si || 0) < 0.75).length,
    moderate: countries.filter(c => (c.composite_si || 0) >= 0.25 && (c.composite_si || 0) < 0.5).length,
    low: countries.filter(c => (c.composite_si || 0) < 0.25).length,
    avg_si: Number(avg('composite_si').toFixed(3)),
    domain_avgs: {
      energy: Number(avg('energy_si').toFixed(3)),
      trade: Number(avg('trade_si').toFixed(3)),
      food: Number(avg('food_si').toFixed(3))
    }
  }
}

export function buildScenarioNetwork(result) {
  const countries = flattenScenarioCountries(result)
  const nodeMap = new Map(countries.map(c => [c.country_code, c]))
  const edges = []
  const seen = new Set()

  STEPS.forEach(step => {
    Object.entries(result?.cascade?.[step] || {}).forEach(([code, data]) => {
      const sources = [data.from, data.from_a, data.from_b].filter(Boolean)
      sources.forEach(source => {
        if (!nodeMap.has(source) || !nodeMap.has(code) || source === code) return
        const key = `${source}->${code}`
        if (seen.has(key)) return
        seen.add(key)
        edges.push({
          source,
          target: code,
          weight: Number((((nodeMap.get(source)?.composite_si || 0) + (data.composite_si || 0)) / 2).toFixed(3)),
          step
        })
      })
    })
  })

  return {
    nodes: countries.map(c => ({
      id: c.country_code,
      name: c.name || c.country_code,
      composite_si: c.composite_si || 0,
      energy_si: c.energy_si || 0,
      trade_si: c.trade_si || 0,
      food_si: c.food_si || 0,
      risk_level: c.risk_level || 'unknown',
      risk_color: c.risk_color || '#94a3b8',
      affected_by: c.affected_by || 'scenario',
      size: Math.max(7, (c.composite_si || 0) * 24)
    })),
    edges,
    count: { nodes: countries.length, edges: edges.length }
  }
}

export function buildScenarioBottlenecks(result, limit = 10) {
  const net = buildScenarioNetwork(result)
  const degree = new Map()
  net.nodes.forEach(n => degree.set(n.id, 0))
  net.edges.forEach(e => {
    degree.set(e.source, (degree.get(e.source) || 0) + e.weight)
    degree.set(e.target, (degree.get(e.target) || 0) + e.weight)
  })
  const maxDegree = Math.max(...degree.values(), 1)

  return net.nodes
    .map(n => ({
      country_code: n.id,
      name: n.name,
      centrality: Number(((degree.get(n.id) || 0) / maxDegree).toFixed(3)),
      composite_si: n.composite_si,
      risk_level: n.risk_level,
      risk_color: n.risk_color,
      cascade_impact: Number((((degree.get(n.id) || 0) / maxDegree) * n.composite_si).toFixed(4))
    }))
    .sort((a, b) => b.cascade_impact - a.cascade_impact)
    .slice(0, limit)
}

export function buildScenarioClusters(result) {
  const groups = new Map()
  flattenScenarioCountries(result).forEach(c => {
    const key = c.affected_by || `t${c.timestep ?? 0}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  })

  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members], index) => ({
      cluster_id: index + 1,
      size: members.length,
      avg_si: Number((members.reduce((sum, m) => sum + (m.composite_si || 0), 0) / members.length).toFixed(3)),
      region: 'Scenario exposure',
      risk_level: members.some(m => (m.composite_si || 0) >= 0.75) ? 'critical' : 'high',
      members,
      label: key === 'both' ? 'Shared exposure' : key === 'a' ? 'Party A spillover' : key === 'b' ? 'Party B spillover' : 'Scenario cluster'
    }))
    .sort((a, b) => b.avg_si - a.avg_si)
}
