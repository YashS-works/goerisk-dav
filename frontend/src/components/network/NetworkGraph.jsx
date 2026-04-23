import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import useDataStore from '../../store/useDataStore'
import useBrushStore from '../../store/useBrushStore'
import useSimStore from '../../store/useSimStore'
import { siToColor } from '../../utils/colorScale'
import { analyticsAPI } from '../../api/analytics'

const CARD = {
    background: '#0d1528',
    border: '1px solid #1e2d4a',
    borderRadius: '12px',
    overflow: 'hidden'
}

export default function NetworkGraph() {
    const svgRef = useRef(null)
    const wrapRef = useRef(null)
    const simRef = useRef(null)

    const { shockType, intensity } = useSimStore()
    const { setHoveredCountry } = useBrushStore()
    const hoveredCountry = useBrushStore(s => s.hoveredCountry)

    const [netData, setNetData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState(null)
    const [netLayer, setNetLayer] = useState('all')
    const [centrality, setCentrality] = useState([])

    // Load network data from backend
    useEffect(() => {
        loadNetwork()
    }, [shockType, intensity])

    // Redraw when data or layer changes
    useEffect(() => {
        if (netData) drawGraph(netData)
    }, [netData, netLayer])

    // Highlight hovered node (from brushing)
    useEffect(() => {
        if (!svgRef.current) return
        d3.select(svgRef.current)
            .selectAll('circle.node')
            .attr('stroke-width', d =>
                d.id === hoveredCountry ? 3.5 : 1.5
            )
            .attr('stroke', d =>
                d.id === hoveredCountry
                    ? '#ffffff'
                    : siToColor(d.composite_si)
            )
            .attr('opacity', d => {
                if (!hoveredCountry) return 1
                return d.id === hoveredCountry ? 1 : 0.4
            })
    }, [hoveredCountry])

    // Listen for external hover events (from map, vuln list etc)
    useEffect(() => {
        function onExternalHover(e) {
            const code = e.detail?.code
            if (!svgRef.current) return
            d3.select(svgRef.current)
                .selectAll('circle.node')
                .attr('stroke-width', d => d.id === code ? 3.5 : 1.5)
                .attr('stroke', d =>
                    d.id === code ? '#ffffff' : siToColor(d.composite_si)
                )
                .attr('opacity', d => {
                    if (!code) return 1
                    return d.id === code ? 1 : 0.4
                })
        }
        window.addEventListener('georisk:hover', onExternalHover)
        return () => window.removeEventListener('georisk:hover', onExternalHover)
    }, [])

    async function loadNetwork() {
        try {
            setLoading(true)
            const [netRes, btRes] = await Promise.all([
                analyticsAPI.getNetwork(shockType, intensity),
                analyticsAPI.getBottlenecks(shockType, intensity)
            ])
            setNetData(netRes)
            setCentrality(btRes.bottlenecks || [])
        } catch (e) {
            console.error('Network load error:', e)
        } finally {
            setLoading(false)
        }
    }

    function drawGraph(data) {
        if (!svgRef.current || !wrapRef.current) return

        const W = wrapRef.current.offsetWidth || 680
        const H = 380

        d3.select(svgRef.current).selectAll('*').remove()
        if (simRef.current) simRef.current.stop()

        const svg = d3.select(svgRef.current)
            .attr('width', W)
            .attr('height', H)

        svg.append('rect')
            .attr('width', W).attr('height', H)
            .attr('fill', '#070d1a')

        // Dot grid
        const g = svg.append('g')
        for (let x = 0; x < W; x += 40) {
            for (let y = 0; y < H; y += 40) {
                g.append('circle')
                    .attr('cx', x).attr('cy', y).attr('r', .8)
                    .attr('fill', 'rgba(255,255,255,0.04)')
            }
        }

        // Filter by layer
        let nodes = [...(data.nodes || [])]
        if (netLayer === 'energy') nodes = nodes.filter(n => (n.energy_si || 0) > 0.3)
        if (netLayer === 'trade') nodes = nodes.filter(n => (n.trade_si || 0) > 0.3)
        if (netLayer === 'food') nodes = nodes.filter(n => (n.food_si || 0) > 0.3)

        const nodeIds = new Set(nodes.map(n => n.id))
        const links = (data.edges || [])
            .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
            .map(e => ({ ...e }))

        const sim = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(65).strength(0.4))
            .force('charge', d3.forceManyBody().strength(d => -70 - (d.composite_si || 0) * 40))
            .force('center', d3.forceCenter(W / 2, H / 2))
            .force('collision', d3.forceCollide().radius(d => (d.size || 8) + 5))

        simRef.current = sim

        // Arrow marker
        const defs = svg.append('defs')
        defs.append('marker')
            .attr('id', 'arrow2').attr('viewBox', '0 -4 8 8')
            .attr('refX', 14).attr('refY', 0)
            .attr('markerWidth', 5).attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#2a3d5e')

        // Edges
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', '#1e2d4a')
            .attr('stroke-width', d => Math.max(.5, (d.weight || 0) * 3))
            .attr('stroke-opacity', .6)
            .attr('marker-end', 'url(#arrow2)')

        // Node groups
        const node = svg.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .style('cursor', 'pointer')
            .call(
                d3.drag()
                    .on('start', (ev, d) => {
                        if (!ev.active) sim.alphaTarget(.3).restart()
                        d.fx = d.x; d.fy = d.y
                    })
                    .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
                    .on('end', (ev, d) => {
                        if (!ev.active) sim.alphaTarget(0)
                        d.fx = null; d.fy = null
                    })
            )

        // Halo
        node.append('circle')
            .attr('r', d => (d.size || 8) + 5)
            .attr('fill', d => siToColor(d.composite_si || 0))
            .attr('opacity', d => (d.composite_si || 0) * .12)

        // Main circle
        node.append('circle')
            .attr('class', 'node')
            .attr('r', d => d.size || 8)
            .attr('fill', d => siToColor(d.composite_si || 0) + '20')
            .attr('stroke', d => siToColor(d.composite_si || 0))
            .attr('stroke-width', 1.5)

        // Label
        node.append('text')
            .attr('dy', '.35em')
            .attr('text-anchor', 'middle')
            .style('font-size', d => (d.size || 8) > 10 ? '8px' : '7px')
            .style('font-weight', '700')
            .style('font-family', 'JetBrains Mono, monospace')
            .style('fill', d => siToColor(d.composite_si || 0))
            .style('pointer-events', 'none')
            .text(d => d.id)

        // SI below label
        node.append('text')
            .attr('dy', '1.6em')
            .attr('text-anchor', 'middle')
            .style('font-size', '6px')
            .style('font-family', 'JetBrains Mono, monospace')
            .style('fill', '#5a7494')
            .style('pointer-events', 'none')
            .text(d => (d.composite_si || 0).toFixed(2))

        // Hover interactions
        node
            .on('mouseenter', (event, d) => {
                setHoveredCountry(d.id)
                setSelected(d)

                link
                    .attr('stroke', l =>
                        l.source.id === d.id || l.target.id === d.id
                            ? siToColor(d.composite_si || 0) : '#1e2d4a'
                    )
                    .attr('stroke-opacity', l =>
                        l.source.id === d.id || l.target.id === d.id ? 1 : .15
                    )
                    .attr('stroke-width', l =>
                        l.source.id === d.id || l.target.id === d.id
                            ? Math.max(2, (l.weight || 0) * 4) : Math.max(.5, (l.weight || 0) * 3)
                    )

                node.attr('opacity', n => {
                    if (n.id === d.id) return 1
                    return links.some(l =>
                        (l.source.id === d.id && l.target.id === n.id) ||
                        (l.target.id === d.id && l.source.id === n.id)
                    ) ? 1 : .25
                })
            })
            .on('mouseleave', () => {
                setHoveredCountry(null)
                link
                    .attr('stroke', '#1e2d4a')
                    .attr('stroke-opacity', .6)
                    .attr('stroke-width', d => Math.max(.5, (d.weight || 0) * 3))
                node.attr('opacity', 1)
            })
            .on('click', (event, d) => setSelected(d))

        // Tick
        sim.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y)

            node.attr('transform', d =>
                `translate(${Math.max(12, Math.min(W - 12, d.x))},${Math.max(12, Math.min(H - 12, d.y))})`
            )
        })
    }

    const LAYERS = [
        { id: 'all', label: 'All domains', col: '#9aaec8' },
        { id: 'energy', label: '⚡ Energy', col: '#18b8d8' },
        { id: 'trade', label: '🚢 Trade', col: '#2ebc6e' },
        { id: 'food', label: '🌾 Food', col: '#e8b418' },
    ]

    return (
        <div style={{ paddingBottom: '24px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: '14px'
            }}>

                {/* Main graph canvas */}
                <div style={CARD}>
                    {/* Controls */}
                    <div style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #1e2d4a',
                        display: 'flex', alignItems: 'center',
                        gap: '6px', flexWrap: 'wrap'
                    }}>
                        <span style={{
                            fontSize: 9, fontWeight: 700, color: '#3a5070',
                            letterSpacing: '.08em', textTransform: 'uppercase',
                            fontFamily: 'JetBrains Mono,monospace', marginRight: '6px'
                        }}>
                            Layer:
                        </span>
                        {LAYERS.map(l => (
                            <button key={l.id}
                                onClick={() => setNetLayer(l.id)}
                                style={{
                                    padding: '4px 11px', borderRadius: '20px',
                                    fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                                    fontFamily: 'Syne,sans-serif',
                                    border: `1px solid ${netLayer === l.id ? l.col : '#1e2d4a'}`,
                                    background: netLayer === l.id ? `${l.col}18` : 'transparent',
                                    color: netLayer === l.id ? l.col : '#3a5070',
                                    transition: 'all .18s'
                                }}
                            >
                                {l.label}
                            </button>
                        ))}
                        <button
                            onClick={loadNetwork}
                            style={{
                                marginLeft: 'auto', padding: '4px 11px',
                                borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'Syne,sans-serif',
                                border: '1px solid #1e2d4a', background: 'transparent',
                                color: '#5a7494', transition: 'all .18s'
                            }}
                        >
                            {loading ? '⏳' : '↺ Refresh'}
                        </button>
                    </div>

                    {/* SVG */}
                    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
                        {loading && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(7,13,26,.85)', zIndex: 10,
                                fontSize: 12, color: '#5a7494', fontFamily: 'Syne,sans-serif'
                            }}>
                                Building force graph...
                            </div>
                        )}
                        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
                    </div>

                    {/* Legend */}
                    <div style={{
                        padding: '8px 14px', borderTop: '1px solid #1e2d4a',
                        display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center'
                    }}>
                        {[
                            { col: '#e8294a', label: 'Critical (>0.75)' },
                            { col: '#e8b418', label: 'High (0.50–0.74)' },
                            { col: '#2ebc6e', label: 'Low (<0.50)' },
                        ].map((l, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: l.col }} />
                                <span style={{ fontSize: 10, color: '#5a7494', fontFamily: 'JetBrains Mono,monospace' }}>{l.label}</span>
                            </div>
                        ))}
                        <span style={{ fontSize: 10, color: '#3a5070', marginLeft: 'auto', fontFamily: 'JetBrains Mono,monospace' }}>
                            Drag · Hover to link · Click for detail
                        </span>
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Selected node detail */}
                    {selected ? (
                        <div style={CARD}>
                            <div style={{
                                padding: '10px 12px', borderBottom: '1px solid #1e2d4a',
                                display: 'flex', alignItems: 'center', gap: '7px'
                            }}>
                                <div style={{
                                    width: 9, height: 9, borderRadius: '50%',
                                    background: siToColor(selected.composite_si || 0),
                                    boxShadow: `0 0 7px ${siToColor(selected.composite_si || 0)}`
                                }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8eef8', fontFamily: 'Syne,sans-serif' }}>
                                    {selected.name || selected.id}
                                </span>
                            </div>
                            <div style={{ padding: '10px 12px' }}>
                                {[
                                    { label: 'Composite SI', val: (selected.composite_si || 0).toFixed(3), col: siToColor(selected.composite_si || 0) },
                                    { label: 'Energy SI', val: (selected.energy_si || 0).toFixed(3), col: '#18b8d8' },
                                    { label: 'Trade SI', val: (selected.trade_si || 0).toFixed(3), col: '#2ebc6e' },
                                    { label: 'Food SI', val: (selected.food_si || 0).toFixed(3), col: '#e8b418' },
                                    { label: 'Risk level', val: selected.risk_level || '—', col: siToColor(selected.composite_si || 0) },
                                    { label: 'Region', val: selected.region || '—', col: '#9aaec8' },
                                ].map((r, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '5px 0',
                                        borderBottom: i < 5 ? '1px solid #1e2d4a' : 'none'
                                    }}>
                                        <span style={{ fontSize: 10, color: '#5a7494', fontFamily: 'JetBrains Mono,monospace' }}>{r.label}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: r.col, fontFamily: 'JetBrains Mono,monospace', textTransform: 'capitalize' }}>{r.val}</span>
                                    </div>
                                ))}
                                {/* Domain bars */}
                                <div style={{ marginTop: '10px' }}>
                                    {[
                                        { icon: '⚡', val: selected.energy_si || 0, col: '#18b8d8' },
                                        { icon: '🚢', val: selected.trade_si || 0, col: '#2ebc6e' },
                                        { icon: '🌾', val: selected.food_si || 0, col: '#e8b418' },
                                    ].map((d, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                                            <span style={{ fontSize: '11px' }}>{d.icon}</span>
                                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${d.val * 100}%`, background: d.col }} />
                                            </div>
                                            <span style={{ fontSize: '9px', color: d.col, fontFamily: 'JetBrains Mono,monospace', width: '28px', textAlign: 'right' }}>
                                                {d.val.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ ...CARD, padding: '20px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '22px', marginBottom: '8px' }}>🌐</div>
                            <div style={{ fontSize: 11, color: '#5a7494', fontFamily: 'Syne,sans-serif' }}>
                                Click any node to see its SI profile
                            </div>
                        </div>
                    )}

                    {/* Centrality ranking */}
                    <div style={CARD}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e2d4a' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#3a5070', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono,monospace' }}>
                                Centrality ranking
                            </span>
                        </div>
                        <div style={{ padding: '6px 0' }}>
                            {centrality.slice(0, 8).map((c, i) => (
                                <div key={i}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '7px',
                                        padding: '6px 12px',
                                        borderBottom: '1px solid rgba(30,45,74,.4)',
                                        cursor: 'pointer', transition: 'background .15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    onClick={() => {
                                        const n = netData?.nodes?.find(n => n.id === c.country_code)
                                        if (n) setSelected(n)
                                    }}
                                >
                                    <span style={{ width: 16, fontSize: 10, fontWeight: 700, color: '#3a5070', fontFamily: 'JetBrains Mono,monospace' }}>{i + 1}</span>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: siToColor(c.composite_si || 0), flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#9aaec8', fontFamily: 'JetBrains Mono,monospace' }}>{c.country_code}</span>
                                    <div style={{ width: 55, height: '3px', background: 'rgba(255,255,255,.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min(100, (c.centrality || 0) * 500)}%`, background: siToColor(c.composite_si || 0) }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: siToColor(c.composite_si || 0), fontFamily: 'JetBrains Mono,monospace', width: '32px', textAlign: 'right' }}>
                                        {(c.composite_si || 0).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                            {centrality.length === 0 && !loading && (
                                <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: '#3a5070', fontFamily: 'Syne,sans-serif' }}>
                                    No data — run a simulation first
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Network stats */}
                    <div style={CARD}>
                        <div style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#3a5070', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono,monospace', marginBottom: '10px' }}>Network stats</div>
                            {[
                                { label: 'Nodes', val: netData?.count?.nodes || 0, col: '#18b8d8' },
                                { label: 'Edges', val: netData?.count?.edges || 0, col: '#2ebc6e' },
                                { label: 'Active layer', val: netLayer === 'all' ? 'All' : netLayer, col: '#e8b418' },
                                { label: 'Shock type', val: shockType, col: '#e8294a' },
                            ].map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 3 ? '1px solid #1e2d4a' : 'none' }}>
                                    <span style={{ fontSize: 10, color: '#5a7494', fontFamily: 'JetBrains Mono,monospace' }}>{s.label}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: s.col, fontFamily: 'JetBrains Mono,monospace', textTransform: 'capitalize' }}>{s.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}