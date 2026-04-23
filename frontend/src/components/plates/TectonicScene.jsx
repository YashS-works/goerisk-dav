import { useEffect, useState, useRef, useCallback } from 'react'
import useSimStore from '../../store/useSimStore'
import useDataStore from '../../store/useDataStore'

// Country positions on map (% of container width/height)
// Calibrated to the colorful world map image
const REGIONS = [
    { id: 'USA', name: 'United States', label: 'Epicenter: New York', x: 12, y: 30, col: '#e8294a', domain: 'energy', ring: true },
    { id: 'CAN', name: 'Canada', label: 'Supply Chain Disruption', x: 12, y: 15, col: '#e8294a', domain: 'trade' },
    { id: 'BRA', name: 'Brazil', label: 'Export Delays · Price Volatility', x: 23, y: 62, col: '#e8721a', domain: 'food' },
    { id: 'EUR', name: 'Europe', label: 'Energy Costs +32% · Food Inflation', x: 47, y: 20, col: '#2ebc6e', domain: 'energy' },
    { id: 'RUS', name: 'Russia', label: 'Fertilizer Exports Restricted', x: 65, y: 12, col: '#6b2fc4', domain: 'food' },
    { id: 'AFR', name: 'Africa', label: 'Food Imports Severely Affected', x: 50, y: 52, col: '#e8b418', domain: 'food' },
    { id: 'M_EAST', name: 'Middle East', label: 'Oil Price Spike · Supply Reallocation', x: 60, y: 35, col: '#d42090', domain: 'energy' },
    { id: 'C_ASIA', name: 'Central Asia', label: 'Supply Chain Bottlenecks', x: 66, y: 22, col: '#18a89e', domain: 'trade' },
    { id: 'S_ASIA', name: 'South Asia', label: 'Food Security Under Threat', x: 70, y: 38, col: '#e86820', domain: 'food' },
    { id: 'E_ASIA', name: 'East Asia', label: 'Shipping Delays · Import Costs Up', x: 83, y: 20, col: '#18b8d8', domain: 'trade' },
    { id: 'SE_ASIA', name: 'Southeast Asia', label: 'Production & Trade Disrupted', x: 80, y: 45, col: '#38b848', domain: 'trade' },
    { id: 'AUS', name: 'Australia & Oceania', label: 'Market Volatility · Export Shifts', x: 85, y: 65, col: '#2855e8', domain: 'trade' },
    { id: 'N_AM', name: 'North America', label: 'Energy Prices +18% · Food Delayed', x: 10, y: 42, col: '#e8294a', domain: 'energy' },
]

// Animated trade arcs between regions
const ARCS = [
    { from: 'USA', to: 'EUR', col: '#18b8d8', delay: 0 },
    { from: 'USA', to: 'E_ASIA', col: '#18b8d8', delay: 0.3 },
    { from: 'USA', to: 'AFR', col: '#e8b418', delay: 0.6 },
    { from: 'USA', to: 'M_EAST', col: '#d42090', delay: 0.9 },
    { from: 'USA', to: 'S_ASIA', col: '#e86820', delay: 1.2 },
    { from: 'EUR', to: 'RUS', col: '#6b2fc4', delay: 1.5 },
    { from: 'M_EAST', to: 'S_ASIA', col: '#e86820', delay: 1.8 },
    { from: 'E_ASIA', to: 'AUS', col: '#2855e8', delay: 2.1 },
    { from: 'BRA', to: 'AFR', col: '#e8b418', delay: 2.4 },
    { from: 'RUS', to: 'C_ASIA', col: '#18a89e', delay: 2.7 },
]

const DOMAIN_COLORS = {
    energy: '#18b8d8',
    trade: '#2ebc6e',
    food: '#e8b418'
}

const TIMELINE = [
    { time: 'T+00:00', label: 'NYC Disruption Occurs', col: '#e8294a', step: 0 },
    { time: 'T+01:00', label: 'Energy Markets React', col: '#18b8d8', step: 1 },
    { time: 'T+03:00', label: 'Shipping Delays Begin', col: '#2ebc6e', step: 2 },
    { time: 'T+06:00', label: 'Food Supply Impacted', col: '#e8b418', step: 3 },
    { time: 'T+12:00', label: 'Global Markets Affected', col: '#6b2fc4', step: 4 },
]

const STAGE_CARDS = [
    { num: 1, title: 'Primary Shock', sub: 'New York City Disruption', detail: 'Financial & Logistics Hub Compromised', col: '#e8294a', icon: '💥' },
    { num: 2, title: 'Energy Market Impact', sub: 'Supply & Price Volatility', detail: 'Oil Prices Spike · Supply Chains Tighten', col: '#18b8d8', icon: '⚡' },
    { num: 3, title: 'Food Trade Disruption', sub: 'Export & Shipping Delays', detail: 'Atlantic Routes Congested & Delayed', col: '#e8b418', icon: '🌾' },
    { num: 4, title: 'Global Production Hit', sub: 'Fertilizer & Farming Affected', detail: 'Input Shortages Reduce Yield Output', col: '#2ebc6e', icon: '🏭' },
    { num: 5, title: 'Cascading Effects', sub: 'Spillover to Multiple Regions', detail: 'Global Inflation · Food & Energy Crisis', col: '#6b2fc4', icon: '🌐' },
    { num: 6, title: 'Systemic Impact', sub: 'Worldwide Consequences', detail: 'Food Shortages · Energy Scarcity · Unrest', col: '#d42090', icon: '⚠' },
]

const OUTCOMES = [
    {
        title: 'Food Trade Impact',
        col: '#e8b418', icon: '🌾',
        points: ['Global Food Prices +28%', 'Export Reductions', 'Supply Chain Delays', 'Food Security Risk'],
        level: 'HIGH'
    },
    {
        title: 'Energy Impact',
        col: '#18b8d8', icon: '⚡',
        points: ['Oil Prices +23.4%', 'Gas Supply Tightness', 'Energy Inflation', 'Grid Reliability Pressure'],
        level: 'HIGH'
    },
    {
        title: 'Global Trade Impact',
        col: '#2ebc6e', icon: '🚢',
        points: ['Shipping Costs +19%', 'Route Inefficiencies', 'Delivery Delays', 'Economic Slowdown'],
        level: 'MEDIUM'
    },
    {
        title: 'Human Impact',
        col: '#6b2fc4', icon: '👥',
        points: ['Cost of Living Crisis', 'Resource Competition', 'Social Instability', 'Migration Pressure'],
        level: 'HIGH'
    },
]

function useInterval(cb, delay) {
    const ref = useRef(cb)
    useEffect(() => { ref.current = cb }, [cb])
    useEffect(() => {
        if (delay === null) return
        const id = setInterval(() => ref.current(), delay)
        return () => clearInterval(id)
    }, [delay])
}

export default function TectonicScene() {
    const { result, hasRun, selA, selB, shockType, intensity } = useSimStore()
    const { siMap } = useDataStore()

    const [activeStep, setActiveStep] = useState(-1)
    const [timeSeconds, setTimeSeconds] = useState(0)
    const [simActive, setSimActive] = useState(false)
    const [affectedRegs, setAffectedRegs] = useState(new Set())
    const [arcProgress, setArcProgress] = useState(0)
    const svgRef = useRef(null)
    const [svgSize, setSvgSize] = useState({ w: 900, h: 400 })

    useEffect(() => {
        function updateSize() {
            if (svgRef.current) {
                setSvgSize({
                    w: svgRef.current.offsetWidth || 900,
                    h: svgRef.current.offsetHeight || 400
                })
            }
        }
        updateSize()
        window.addEventListener('resize', updateSize)
        return () => window.removeEventListener('resize', updateSize)
    }, [])

    // Auto-run when simulation fires
    useEffect(() => {
        if (hasRun && result) {
            startSimulation()
        }
    }, [result, hasRun])

    function startSimulation() {
        setSimActive(true)
        setActiveStep(0)
        setTimeSeconds(0)
        setAffectedRegs(new Set(['USA']))
        setArcProgress(0)

        // Cascade each step
        setTimeout(() => { setActiveStep(1); setAffectedRegs(new Set(['USA', 'CAN', 'EUR', 'N_AM'])) }, 1000)
        setTimeout(() => { setActiveStep(2); setAffectedRegs(new Set(['USA', 'CAN', 'EUR', 'N_AM', 'E_ASIA', 'M_EAST'])) }, 3000)
        setTimeout(() => { setActiveStep(3); setAffectedRegs(new Set(['USA', 'CAN', 'EUR', 'N_AM', 'E_ASIA', 'M_EAST', 'AFR', 'S_ASIA', 'BRA'])) }, 6000)
        setTimeout(() => { setActiveStep(4); setAffectedRegs(new Set(REGIONS.map(r => r.id))) }, 12000)
    }

    // Timer
    useInterval(() => {
        if (simActive) setTimeSeconds(s => s + 1)
    }, simActive ? 1000 : null)

    // Arc animation
    useInterval(() => {
        if (simActive) setArcProgress(p => (p + 1) % 100)
    }, simActive ? 50 : null)

    const formatTime = (s) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = s % 60
        return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }

    // Get region position in SVG coords
    function regPos(id) {
        const r = REGIONS.find(r => r.id === id)
        if (!r) return { x: 0, y: 0 }
        return {
            x: (r.x / 100) * svgSize.w,
            y: (r.y / 100) * svgSize.h
        }
    }

    // Quadratic bezier arc
    function arcPath(x1, y1, x2, y2) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.25
        return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
    }

    // Get real SI for region
    function getRegionSI(regionId) {
        const regionToCode = {
            'USA': 'USA', 'CAN': 'CAN', 'BRA': 'BRA', 'EUR': 'DEU',
            'RUS': 'RUS', 'AFR': 'NGA', 'M_EAST': 'SAU', 'C_ASIA': 'KAZ',
            'S_ASIA': 'IND', 'E_ASIA': 'CHN', 'SE_ASIA': 'IDN', 'AUS': 'AUS', 'N_AM': 'USA'
        }
        const code = regionToCode[regionId]
        return code && siMap[code] ? siMap[code].composite_si : null
    }

    // Cascade spread %
    const spreadPct = Math.round((affectedRegs.size / REGIONS.length) * 100)

    return (
        <div style={{
            background: '#050a14',
            color: '#e8eef8',
            fontFamily: 'Syne, sans-serif',
            minHeight: '100vh',
            paddingBottom: '24px'
        }}>

            {/* ── HEADER ── */}
            <div style={{
                background: 'rgba(13,21,40,.95)',
                borderBottom: '1px solid #1e2d4a',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div>
                    <div style={{
                        fontSize: 14, fontWeight: 800,
                        letterSpacing: '.04em',
                        background: 'linear-gradient(90deg,#e8294a,#18b8d8,#2ebc6e)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        LAYER CASCADING: FOOD TRADE & ENERGY UNDER {selA?.name?.toUpperCase() || 'NYC'} SHOCK SIMULATION
                    </div>
                    <div style={{ fontSize: 11, color: '#5a7494', marginTop: '2px' }}>
                        A {selA?.name || 'New York City'} disruption triggers a multi-layer cascade affecting energy, food trade & global stability
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: simActive ? 'rgba(232,41,74,.12)' : 'rgba(30,45,74,.5)',
                    border: `1px solid ${simActive ? 'rgba(232,41,74,.4)' : '#1e2d4a'}`,
                    borderRadius: '10px',
                    padding: '8px 14px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: simActive ? '#e8294a' : '#3a5070',
                        animation: simActive ? 'siPulse 1s ease-in-out infinite' : 'none'
                    }} />
                    <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: simActive ? '#e8294a' : '#5a7494', letterSpacing: '.1em' }}>
                            {simActive ? 'SIMULATION ACTIVE' : 'SIMULATION IDLE'}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eef8', fontFamily: 'JetBrains Mono, monospace' }}>
                            {formatTime(timeSeconds)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 6 STAGE CARDS ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6,1fr)',
                gap: '8px',
                padding: '12px 20px'
            }}>
                {STAGE_CARDS.map((card, i) => {
                    const isActive = activeStep >= i
                    return (
                        <div key={i} style={{
                            background: isActive ? `${card.col}10` : 'rgba(13,21,40,.6)',
                            border: `1px solid ${isActive ? card.col + '60' : '#1e2d4a'}`,
                            borderRadius: '10px',
                            padding: '10px 12px',
                            transition: 'all .5s ease',
                            boxShadow: isActive ? `0 0 16px ${card.col}25` : 'none',
                            animation: isActive ? `cardAppear .5s ease ${i * .1}s both` : 'none'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '6px', marginBottom: '5px'
                            }}>
                                <div style={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: isActive ? card.col : '#1e2d4a',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '8px', fontWeight: 700,
                                    color: 'white', flexShrink: 0,
                                    transition: 'background .5s'
                                }}>
                                    {card.num}
                                </div>
                                <span style={{ fontSize: '11px' }}>{card.icon}</span>
                            </div>
                            <div style={{
                                fontSize: 10, fontWeight: 700,
                                color: isActive ? card.col : '#5a7494',
                                marginBottom: '2px', lineHeight: 1.3,
                                transition: 'color .5s'
                            }}>
                                {card.title}
                            </div>
                            <div style={{ fontSize: 9, color: '#5a7494', lineHeight: 1.4 }}>
                                {card.detail}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── MAIN SECTION — LEFT PANEL + MAP ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                gap: '12px',
                padding: '0 20px'
            }}>

                {/* Left panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Cascade layers legend */}
                    <div style={{
                        background: 'rgba(13,21,40,.8)',
                        border: '1px solid #1e2d4a',
                        borderRadius: '10px',
                        padding: '12px'
                    }}>
                        <div style={{
                            fontSize: 9, fontWeight: 700, color: '#3a5070',
                            letterSpacing: '.1em', textTransform: 'uppercase',
                            fontFamily: 'JetBrains Mono, monospace',
                            marginBottom: '10px'
                        }}>
                            Cascade Layers
                        </div>
                        {[
                            { icon: '🔴', label: 'Shock Origin', col: '#e8294a', active: activeStep >= 0 },
                            { icon: '⚡', label: 'Energy Network Impact', col: '#18b8d8', active: activeStep >= 1 },
                            { icon: '🌾', label: 'Food Production Impact', col: '#e8b418', active: activeStep >= 3 },
                            { icon: '🚢', label: 'Trade Route Disruption', col: '#2ebc6e', active: activeStep >= 2 },
                            { icon: '🌐', label: 'Cascade Spread', col: '#6b2fc4', active: activeStep >= 4 },
                        ].map((l, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                marginBottom: '8px', opacity: l.active ? 1 : .4,
                                transition: 'opacity .5s'
                            }}>
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: l.active ? l.col : '#3a5070',
                                    transition: 'background .5s',
                                    boxShadow: l.active ? `0 0 6px ${l.col}` : 'none'
                                }} />
                                <span style={{ fontSize: 10, color: l.active ? '#9aaec8' : '#3a5070' }}>
                                    {l.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Timeline */}
                    <div style={{
                        background: 'rgba(13,21,40,.8)',
                        border: '1px solid #1e2d4a',
                        borderRadius: '10px',
                        padding: '12px'
                    }}>
                        <div style={{
                            fontSize: 9, fontWeight: 700, color: '#3a5070',
                            letterSpacing: '.1em', textTransform: 'uppercase',
                            fontFamily: 'JetBrains Mono, monospace',
                            marginBottom: '10px'
                        }}>
                            Simulation Timeline
                        </div>
                        {TIMELINE.map((t, i) => {
                            const isActive = activeStep >= t.step
                            return (
                                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{
                                            width: 9, height: 9, borderRadius: '50%',
                                            background: isActive ? t.col : '#1e2d4a',
                                            border: `1.5px solid ${isActive ? t.col : '#2a3d5e'}`,
                                            flexShrink: 0, transition: 'all .5s',
                                            boxShadow: isActive ? `0 0 8px ${t.col}` : 'none'
                                        }} />
                                        {i < TIMELINE.length - 1 && (
                                            <div style={{
                                                width: 1, height: 24,
                                                background: isActive ? t.col + '60' : '#1e2d4a',
                                                transition: 'background .5s'
                                            }} />
                                        )}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: 9, fontWeight: 700,
                                            color: isActive ? t.col : '#3a5070',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            transition: 'color .5s'
                                        }}>
                                            {t.time}
                                        </div>
                                        <div style={{ fontSize: 10, color: isActive ? '#9aaec8' : '#3a5070', lineHeight: 1.3 }}>
                                            {t.label}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Cascade spread meter */}
                    <div style={{
                        background: 'rgba(13,21,40,.8)',
                        border: '1px solid #1e2d4a',
                        borderRadius: '10px',
                        padding: '12px'
                    }}>
                        <div style={{
                            fontSize: 9, fontWeight: 700, color: '#3a5070',
                            letterSpacing: '.1em', textTransform: 'uppercase',
                            fontFamily: 'JetBrains Mono, monospace',
                            marginBottom: '8px'
                        }}>
                            Cascade Spread
                        </div>
                        <div style={{
                            fontSize: 28, fontWeight: 800,
                            color: '#6b2fc4',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            {spreadPct}%
                        </div>
                        <div style={{
                            height: '6px', background: 'rgba(107,47,196,.15)',
                            borderRadius: '3px', overflow: 'hidden', marginTop: '6px'
                        }}>
                            <div style={{
                                height: '100%', width: `${spreadPct}%`,
                                background: 'linear-gradient(90deg,#6b2fc4,#18b8d8)',
                                borderRadius: '3px', transition: 'width 1s ease'
                            }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#5a7494', marginTop: '5px' }}>
                            Affected countries: {Math.round(affectedRegs.size * 11.8)}
                        </div>
                    </div>

                    {/* Fire button if no simulation */}
                    {!simActive && (
                        <button
                            onClick={startSimulation}
                            style={{
                                padding: '10px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'Syne, sans-serif',
                                border: 'none',
                                background: 'linear-gradient(135deg,#e8294a,#6b2fc4)',
                                color: 'white',
                                boxShadow: '0 0 20px rgba(232,41,74,0.3)',
                            }}
                        >
                            ▶ Preview Cascade
                        </button>
                    )}
                </div>

                {/* ── MAP ── */}
                <div style={{
                    background: 'rgba(5,10,20,.9)',
                    border: '1px solid #1e2d4a',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    minHeight: '400px'
                }}>
                    {/* World map base image */}
                    <img
                        src="/world-map.png"
                        alt="World Map"
                        style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover', display: 'block',
                            position: 'absolute', inset: 0,
                            opacity: 0.65,
                            filter: 'saturate(1.4) brightness(0.8)'
                        }}
                        draggable={false}
                    />

                    {/* Dark overlay for contrast */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg,rgba(5,10,20,.3) 0%,rgba(5,10,20,.1) 50%,rgba(5,10,20,.4) 100%)',
                        pointerEvents: 'none'
                    }} />

                    {/* SVG overlay for all animations */}
                    <svg
                        ref={svgRef}
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%'
                        }}
                    >
                        <defs>
                            <filter id="glow-red">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="glow-blue">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <style>{`
                @keyframes rippleMap {
                  0%   { r:0;   opacity:.9; }
                  100% { r:80;  opacity:0;  }
                }
                @keyframes rippleMap2 {
                  0%   { r:0;   opacity:.7; }
                  100% { r:120; opacity:0;  }
                }
                @keyframes arcFlow {
                  0%   { stroke-dashoffset:1000; }
                  100% { stroke-dashoffset:-1000; }
                }
                @keyframes nodePulse {
                  0%,100% { r:5;  opacity:.9; }
                  50%     { r:9;  opacity:1;  }
                }
                @keyframes siPulse {
                  0%,100% { opacity:.5;  transform:scale(.9); }
                  50%     { opacity:1;   transform:scale(1.1); }
                }
                @keyframes cardAppear {
                  from { opacity:0; transform:translateY(8px); }
                  to   { opacity:1; transform:translateY(0); }
                }
              `}</style>
                        </defs>

                        {/* Trade arcs */}
                        {simActive && ARCS.map((arc, i) => {
                            const from = regPos(arc.from)
                            const to = regPos(arc.to)
                            if (!from.x || !to.x) return null
                            const isVisible = affectedRegs.has(arc.from) && affectedRegs.has(arc.to)
                            if (!isVisible) return null
                            return (
                                <path
                                    key={i}
                                    d={arcPath(from.x, from.y, to.x, to.y)}
                                    fill="none"
                                    stroke={arc.col}
                                    strokeWidth={1.2}
                                    strokeOpacity={.55}
                                    strokeDasharray="8 6"
                                    style={{
                                        animation: `arcFlow ${3 + i * .3}s linear ${arc.delay}s infinite`
                                    }}
                                />
                            )
                        })}

                        {/* NYC Shock ripple rings */}
                        {simActive && (() => {
                            const nyc = regPos('USA')
                            return [0, 0.8, 1.6].map((delay, i) => (
                                <circle
                                    key={i}
                                    cx={nyc.x} cy={nyc.y} r={0}
                                    fill="none"
                                    stroke="#e8294a"
                                    strokeWidth={2}
                                    strokeOpacity={.8}
                                    style={{
                                        animation: `rippleMap ${2.4}s ease-out ${delay}s infinite`
                                    }}
                                />
                            ))
                        })()}

                        {/* Outer ripple */}
                        {simActive && (() => {
                            const nyc = regPos('USA')
                            return (
                                <circle
                                    cx={nyc.x} cy={nyc.y} r={0}
                                    fill="none"
                                    stroke="#e8294a"
                                    strokeWidth={1}
                                    strokeOpacity={.4}
                                    style={{
                                        animation: `rippleMap2 3.5s ease-out .5s infinite`
                                    }}
                                />
                            )
                        })()}

                        {/* Region nodes */}
                        {REGIONS.map((reg, i) => {
                            const pos = regPos(reg.id)
                            const isAffected = affectedRegs.has(reg.id)
                            const si = getRegionSI(reg.id)
                            const isOrigin = reg.id === 'USA'

                            return (
                                <g key={i}>
                                    {/* Halo */}
                                    {isAffected && (
                                        <circle
                                            cx={pos.x} cy={pos.y} r={isOrigin ? 28 : 18}
                                            fill={reg.col}
                                            opacity={.08}
                                        />
                                    )}
                                    {/* Main dot */}
                                    <circle
                                        cx={pos.x} cy={pos.y}
                                        r={isOrigin ? 8 : 5}
                                        fill={isAffected ? reg.col : '#2a3d5e'}
                                        stroke={isAffected ? reg.col : '#1e2d4a'}
                                        strokeWidth={2}
                                        style={{
                                            transition: 'all .8s ease',
                                            filter: isAffected ? `url(#glow-${isOrigin ? 'red' : 'blue'})` : 'none',
                                            animation: isAffected
                                                ? `nodePulse ${isOrigin ? 1.2 : 2}s ease-in-out ${i * .15}s infinite`
                                                : 'none'
                                        }}
                                    />
                                    {/* Center dot */}
                                    <circle cx={pos.x} cy={pos.y} r={2.5} fill="white" opacity={.9} />
                                </g>
                            )
                        })}

                        {/* Floating region labels */}
                        {REGIONS.map((reg, i) => {
                            const pos = regPos(reg.id)
                            const isAffected = affectedRegs.has(reg.id)
                            if (!isAffected) return null
                            const si = getRegionSI(reg.id)

                            // Position label to avoid overlap
                            const lx = pos.x + (pos.x > svgSize.w / 2 ? -110 : 14)
                            const ly = pos.y - 28

                            return (
                                <g key={`label-${i}`} style={{ animation: 'cardAppear .5s ease both' }}>
                                    <rect
                                        x={lx} y={ly}
                                        width={105} height={si !== null ? 40 : 30}
                                        rx={5}
                                        fill="rgba(5,10,20,.85)"
                                        stroke={reg.col}
                                        strokeWidth={.8}
                                        strokeOpacity={.6}
                                    />
                                    <text
                                        x={lx + 6} y={ly + 11}
                                        fontSize={8} fontWeight="700"
                                        fontFamily="Syne, sans-serif"
                                        fill={reg.col}
                                    >
                                        {reg.name.toUpperCase()}
                                    </text>
                                    <text
                                        x={lx + 6} y={ly + 22}
                                        fontSize={7}
                                        fontFamily="Syne, sans-serif"
                                        fill="#9aaec8"
                                    >
                                        {reg.label.length > 20 ? reg.label.slice(0, 20) + '…' : reg.label}
                                    </text>
                                    {si !== null && (
                                        <text
                                            x={lx + 6} y={ly + 33}
                                            fontSize={7} fontWeight="700"
                                            fontFamily="JetBrains Mono, monospace"
                                            fill={si >= .75 ? '#e8294a' : si >= .5 ? '#e8b418' : '#2ebc6e'}
                                        >
                                            SI: {si.toFixed(2)} {DOMAIN_COLORS[reg.domain] ? `· ${reg.domain}` : ''}
                                        </text>
                                    )}
                                </g>
                            )
                        })}
                    </svg>

                    {/* Domain legend overlay */}
                    <div style={{
                        position: 'absolute', bottom: '10px', right: '10px',
                        background: 'rgba(5,10,20,.88)',
                        border: '1px solid #1e2d4a',
                        borderRadius: '8px',
                        padding: '8px 12px'
                    }}>
                        {[
                            { col: '#18b8d8', label: 'Energy cascade' },
                            { col: '#e8b418', label: 'Food cascade' },
                            { col: '#2ebc6e', label: 'Trade cascade' },
                            { col: '#e8294a', label: 'Shock origin' },
                        ].map((l, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                marginBottom: i < 3 ? '4px' : 0,
                                fontSize: 9, color: '#9aaec8',
                                fontFamily: 'Syne, sans-serif'
                            }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.col }} />
                                {l.label}
                            </div>
                        ))}
                    </div>

                    {/* Shock origin label */}
                    {simActive && (
                        <div style={{
                            position: 'absolute', top: '10px', left: '10px',
                            background: 'rgba(232,41,74,.12)',
                            border: '1px solid rgba(232,41,74,.4)',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: 9, fontWeight: 700,
                            color: '#e8294a',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            ⚡ SHOCK ORIGIN: {selA?.name?.toUpperCase() || 'NEW YORK CITY'}
                            {selB && ` vs ${selB.name.toUpperCase()}`}
                        </div>
                    )}
                </div>
            </div>

            {/* ── OUTCOME CARDS ── */}
            <div style={{ padding: '12px 20px 0' }}>
                <div style={{
                    fontSize: 9, fontWeight: 700, color: '#3a5070',
                    letterSpacing: '.15em', textTransform: 'uppercase',
                    fontFamily: 'JetBrains Mono, monospace',
                    textAlign: 'center', marginBottom: '10px'
                }}>
                    Cascading Outcomes
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,1fr)',
                    gap: '10px'
                }}>
                    {OUTCOMES.map((o, i) => (
                        <div key={i} style={{
                            background: `${o.col}08`,
                            border: `1px solid ${o.col}35`,
                            borderRadius: '10px',
                            padding: '14px',
                            animation: activeStep >= 4
                                ? `cardAppear .5s ease ${i * .15}s both` : 'none',
                            opacity: activeStep >= 2 ? 1 : .5,
                            transition: 'opacity 1s ease'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '7px', marginBottom: '8px'
                            }}>
                                <span style={{ fontSize: '18px' }}>{o.icon}</span>
                                <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    color: o.col, fontFamily: 'Syne, sans-serif'
                                }}>
                                    {o.title}
                                </span>
                            </div>
                            {o.points.map((p, j) => (
                                <div key={j} style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    fontSize: 10, color: '#9aaec8', marginBottom: '4px'
                                }}>
                                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: o.col, flexShrink: 0 }} />
                                    {p}
                                </div>
                            ))}
                            <div style={{
                                marginTop: '8px', display: 'inline-block',
                                fontSize: 9, fontWeight: 700,
                                padding: '2px 10px', borderRadius: '20px',
                                background: o.col + '20', color: o.col,
                                fontFamily: 'JetBrains Mono, monospace',
                                letterSpacing: '.06em'
                            }}>
                                IMPACT LEVEL: {o.level}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
        @keyframes siPulse {
          0%,100% { opacity:.5; }
          50%     { opacity:1; }
        }
        @keyframes cardAppear {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
        </div>
    )
}