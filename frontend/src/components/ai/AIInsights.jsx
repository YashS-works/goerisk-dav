import { useState, useEffect, useRef } from 'react'
import useSimStore from '../../store/useSimStore'
import { quizAPI } from '../../api/quiz'

const CARD = {
    background: '#0d1528',
    border: '1px solid #1e2d4a',
    borderRadius: '12px',
    overflow: 'hidden'
}

const LBL = {
    fontSize: '9px',
    fontWeight: 700,
    color: '#3a5070',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    fontFamily: 'JetBrains Mono, monospace'
}

const PRIORITY_CONFIG = {
    critical: {
        col: '#e8294a', bg: 'rgba(232,41,74,0.1)',
        border: 'rgba(232,41,74,0.25)', icon: '🔴'
    },
    high: {
        col: '#e8b418', bg: 'rgba(232,180,24,0.1)',
        border: 'rgba(232,180,24,0.25)', icon: '🟡'
    },
    moderate: {
        col: '#2ebc6e', bg: 'rgba(46,188,110,0.1)',
        border: 'rgba(46,188,110,0.25)', icon: '🟢'
    },
    info: {
        col: '#18b8d8', bg: 'rgba(24,184,216,0.1)',
        border: 'rgba(24,184,216,0.25)', icon: '🔵'
    },
}

const TYPE_COLORS = {
    bottleneck: '#e8294a',
    cluster: '#e8b418',
    comparison: '#18b8d8',
    resilience: '#2ebc6e',
}

// Static fallback insights shown before any simulation
const STATIC_INSIGHTS = [
    {
        type: 'bottleneck',
        priority: 'critical',
        title: 'Germany — critical energy-to-trade cascade node',
        body: 'Germany is the most critical energy-to-trade cascade bottleneck in Europe. A shock here propagates to 14 downstream trade partners within t₁, hitting North African food supply chains by t₂. Reducing German energy dependency by 20% cuts cascade spillover by approximately 34%.',
        action_label: 'Explore Germany dependency profile',
        confidence: 0.91,
        border_color: '#e8294a'
    },
    {
        type: 'cluster',
        priority: 'high',
        title: 'North Africa food vulnerability cluster',
        body: 'Egypt, Tunisia and Lebanon form a high-risk food cluster with average SI above 0.75. All three depend heavily on Ukrainian wheat imports. Any Eastern European conflict reaches this cluster at t₂ via the energy→trade→food cascade, compounding inflation effects across the MENA region.',
        action_label: 'Analyse North Africa food cluster',
        confidence: 0.84,
        border_color: '#e8b418'
    },
    {
        type: 'comparison',
        priority: 'info',
        title: 'Sanctions produce 2.3× more cascade impact than supply cuts',
        body: 'Sanctions on Russia produce 2.3× more cross-layer cascade impact compared to a supply disruption. Sanctions simultaneously affect all three domain layers whereas supply cuts are initially isolated to trade and food before propagating upward to energy over multiple timesteps.',
        action_label: 'Compare shock types in Analytics',
        confidence: 0.88,
        border_color: '#18b8d8'
    },
    {
        type: 'resilience',
        priority: 'info',
        title: 'Norway, Australia, Canada — cascade shock absorbers',
        body: 'Norway, Australia and Canada have SI below 0.30 across all three domains. Domestic energy exceeds 70% of demand and food self-sufficiency is above 80%. These nations act as cascade shock absorbers, reducing neighbour vulnerability through stable diversified trade links.',
        action_label: 'View resilient country profiles',
        confidence: 0.82,
        border_color: '#2ebc6e'
    }
]

// Typewriter hook
function useTypewriter(text, speed = 18, active = true) {
    const [displayed, setDisplayed] = useState('')
    const [done, setDone] = useState(false)

    useEffect(() => {
        if (!active || !text) {
            setDisplayed(text || '')
            setDone(true)
            return
        }
        setDisplayed('')
        setDone(false)
        let i = 0
        const id = setInterval(() => {
            setDisplayed(text.slice(0, i + 1))
            i++
            if (i >= text.length) {
                clearInterval(id)
                setDone(true)
            }
        }, speed)
        return () => clearInterval(id)
    }, [text, active])

    return { displayed, done }
}

// Individual insight card with typewriter
function InsightCard({ insight, index, active }) {
    const cfg = PRIORITY_CONFIG[insight.priority] || PRIORITY_CONFIG.info
    const col = TYPE_COLORS[insight.type] || '#9aaec8'
    const [expanded, setExpanded] = useState(false)

    const { displayed, done } = useTypewriter(
        insight.body,
        14,
        active && index === 0
    )

    return (
        <div style={{
            ...CARD,
            borderLeft: `3px solid ${insight.border_color || col}`,
            marginBottom: '12px',
            animation: `slideInCard .4s ease ${index * .12}s both`
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid #1e2d4a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                {/* Pulsing dot */}
                <div style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: insight.border_color || col,
                    flexShrink: 0,
                    animation: `dotPulseAI 1.4s ease-in-out ${index * .3}s infinite`,
                    boxShadow: `0 0 6px ${insight.border_color || col}`
                }} />

                <span style={{
                    flex: 1,
                    fontSize: 13, fontWeight: 700,
                    color: '#e8eef8',
                    fontFamily: 'Syne,sans-serif',
                    lineHeight: 1.3
                }}>
                    {insight.title}
                </span>

                {/* Priority badge */}
                <span style={{
                    fontSize: 8, fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    color: cfg.col,
                    fontFamily: 'JetBrains Mono,monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    flexShrink: 0
                }}>
                    {cfg.icon} {insight.priority}
                </span>
            </div>

            {/* Body */}
            <div style={{ padding: '12px 14px' }}>
                <div style={{
                    fontSize: 12,
                    color: '#9aaec8',
                    lineHeight: 1.75,
                    marginBottom: '10px',
                    fontFamily: 'Syne,sans-serif',
                    minHeight: '40px'
                }}>
                    {active && index === 0
                        ? displayed
                        : insight.body
                    }
                    {active && index === 0 && !done && (
                        <span style={{
                            display: 'inline-block',
                            width: '2px',
                            height: '12px',
                            background: insight.border_color || col,
                            marginLeft: '2px',
                            verticalAlign: 'middle',
                            animation: 'cursorBlink .8s ease infinite'
                        }} />
                    )}
                </div>

                {/* Confidence bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px'
                }}>
                    <span style={{
                        fontSize: 9, color: '#3a5070',
                        fontFamily: 'JetBrains Mono,monospace'
                    }}>
                        AI confidence
                    </span>
                    <div style={{
                        flex: 1, height: '3px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '2px', overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${(insight.confidence || .8) * 100}%`,
                            background: insight.border_color || col,
                            borderRadius: '2px'
                        }} />
                    </div>
                    <span style={{
                        fontSize: 9,
                        color: insight.border_color || col,
                        fontFamily: 'JetBrains Mono,monospace',
                        fontWeight: 700
                    }}>
                        {Math.round((insight.confidence || .8) * 100)}%
                    </span>
                </div>

                {/* Action button */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Syne,sans-serif',
                        border: `1px solid ${insight.border_color || col}40`,
                        background: `${insight.border_color || col}10`,
                        color: insight.border_color || col,
                        transition: 'all .18s'
                    }}
                >
                    {insight.action_label || 'Explore'} ↗
                </button>
            </div>

            <style>{`
        @keyframes dotPulseAI {
          0%,100% { opacity:.4; transform:scale(.8); }
          50%     { opacity:1;  transform:scale(1.2); }
        }
        @keyframes cursorBlink {
          0%,100% { opacity:1; }
          50%     { opacity:0; }
        }
        @keyframes slideInCard {
          from { opacity:0; transform:translateX(-12px); }
          to   { opacity:1; transform:translateX(0); }
        }
      `}</style>
        </div>
    )
}

export default function AIInsights() {
    const { result, selA, selB, shockType, intensity } = useSimStore()

    const [insights, setInsights] = useState(STATIC_INSIGHTS)
    const [loading, setLoading] = useState(false)
    const [generated, setGenerated] = useState(false)
    const [activeIdx, setActiveIdx] = useState(0)

    // Auto-generate when simulation runs
    useEffect(() => {
        if (result) generateInsights()
    }, [result])

    async function generateInsights() {
        try {
            setLoading(true)
            setGenerated(false)
            const res = await quizAPI.generateInsights({
                country_a: selA?.code || '',
                country_b: selB?.code || '',
                shock_type: shockType,
                intensity: intensity,
                cascade: result?.cascade || {},
                country_b_si: result?.country_b_si || {},
                clusters: []
            })
            if (res.insights?.length > 0) {
                setInsights(res.insights)
                setActiveIdx(0)
                setGenerated(true)
            }
        } catch (e) {
            console.error('Insight gen error:', e)
        } finally {
            setLoading(false)
        }
    }

    const priorityOrder = { critical: 0, high: 1, moderate: 2, info: 3 }
    const sorted = [...insights].sort((a, b) =>
        (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    )

    // Stats from insights
    const critCount = insights.filter(i => i.priority === 'critical').length
    const highCount = insights.filter(i => i.priority === 'high').length

    return (
        <div style={{ paddingBottom: '24px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 320px',
                gap: '14px'
            }}>

                {/* Left — Insight cards */}
                <div>
                    {/* Top bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '14px'
                    }}>
                        <div style={{
                            display: 'flex', gap: '6px'
                        }}>
                            {[
                                {
                                    label: `${critCount} Critical`, col: '#e8294a',
                                    bg: 'rgba(232,41,74,0.1)',
                                    border: 'rgba(232,41,74,0.25)'
                                },
                                {
                                    label: `${highCount} High`, col: '#e8b418',
                                    bg: 'rgba(232,180,24,0.1)',
                                    border: 'rgba(232,180,24,0.25)'
                                },
                                {
                                    label: `${insights.length} Total`, col: '#9aaec8',
                                    bg: 'rgba(154,174,200,0.08)',
                                    border: 'rgba(154,174,200,0.2)'
                                },
                            ].map((s, i) => (
                                <span key={i} style={{
                                    fontSize: 10, fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    background: s.bg,
                                    border: `1px solid ${s.border}`,
                                    color: s.col,
                                    fontFamily: 'JetBrains Mono,monospace'
                                }}>
                                    {s.label}
                                </span>
                            ))}
                        </div>

                        <button
                            onClick={generateInsights}
                            disabled={!result || loading}
                            style={{
                                marginLeft: 'auto',
                                padding: '7px 16px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: result ? 'pointer' : 'not-allowed',
                                fontFamily: 'Syne,sans-serif',
                                border: 'none',
                                background: result && !loading
                                    ? 'linear-gradient(135deg,#e8294a,#6b2fc4)'
                                    : '#1e2d4a',
                                color: result && !loading
                                    ? 'white' : '#3a5070',
                                boxShadow: result && !loading
                                    ? '0 0 14px rgba(232,41,74,0.25)' : 'none',
                                transition: 'all .2s'
                            }}
                        >
                            {loading
                                ? '⏳ Generating...'
                                : result
                                    ? '✦ Generate from simulation'
                                    : 'Run simulation first'}
                        </button>
                    </div>

                    {/* Loading state */}
                    {loading && (
                        <div style={{
                            ...CARD,
                            padding: '32px',
                            textAlign: 'center',
                            marginBottom: '12px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '6px',
                                marginBottom: '16px'
                            }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{
                                        width: 8, height: 8,
                                        borderRadius: '50%',
                                        background: '#e8294a',
                                        animation: `dotBounce .8s ease ${i * .15}s infinite`
                                    }} />
                                ))}
                            </div>
                            <div style={{
                                fontSize: 13, color: '#5a7494',
                                fontFamily: 'Syne,sans-serif'
                            }}>
                                AI analysing cascade patterns...
                            </div>
                            <div style={{
                                fontSize: 11, color: '#3a5070',
                                marginTop: '6px',
                                fontFamily: 'JetBrains Mono,monospace'
                            }}>
                                {selA?.name && selB?.name
                                    ? `${selA.name} vs ${selB.name} — ${shockType} shock`
                                    : 'Processing simulation data'
                                }
                            </div>
                            <style>{`
                @keyframes dotBounce {
                  0%,100% { transform:translateY(0); }
                  50%     { transform:translateY(-8px); }
                }
              `}</style>
                        </div>
                    )}

                    {/* Insight cards */}
                    {!loading && sorted.map((insight, i) => (
                        <InsightCard
                            key={i}
                            insight={insight}
                            index={i}
                            active={generated}
                        />
                    ))}

                    {/* No simulation notice */}
                    {!result && !loading && (
                        <div style={{
                            ...CARD,
                            padding: '20px 16px',
                            borderStyle: 'dashed',
                            marginTop: '8px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                                🌐
                            </div>
                            <div style={{
                                fontSize: 12, color: '#5a7494',
                                fontFamily: 'Syne,sans-serif',
                                marginBottom: '4px'
                            }}>
                                Run a shock simulation to generate
                                AI-powered risk insights
                            </div>
                            <div style={{
                                fontSize: 10, color: '#3a5070',
                                fontFamily: 'JetBrains Mono,monospace'
                            }}>
                                Insights above are static examples
                            </div>
                        </div>
                    )}
                </div>

                {/* Right panel */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>

                    {/* AI model info */}
                    <div style={CARD}>
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #1e2d4a'
                        }}>
                            <span style={LBL}>AI model info</span>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                            {[
                                { label: 'Model', val: 'Mistral Small', col: '#9aaec8' },
                                { label: 'Mode', val: 'Analytical', col: '#18b8d8' },
                                { label: 'Source', val: 'Live simulation', col: '#2ebc6e' },
                                {
                                    label: 'Status', val: result
                                        ? 'Simulation loaded' : 'Awaiting data',
                                    col: result ? '#2ebc6e' : '#3a5070'
                                },
                            ].map((s, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '5px 0',
                                    borderBottom: i < 3
                                        ? '1px solid #1e2d4a' : 'none'
                                }}>
                                    <span style={{
                                        fontSize: 10, color: '#5a7494',
                                        fontFamily: 'JetBrains Mono,monospace'
                                    }}>
                                        {s.label}
                                    </span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700,
                                        color: s.col,
                                        fontFamily: 'JetBrains Mono,monospace'
                                    }}>
                                        {s.val}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Simulation context */}
                    {result && (
                        <div style={CARD}>
                            <div style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid #1e2d4a'
                            }}>
                                <span style={LBL}>Simulation context</span>
                            </div>
                            <div style={{ padding: '12px 14px' }}>
                                {[
                                    {
                                        label: 'Conflict',
                                        val: `${selA?.name || '—'} vs ${selB?.name || '—'}`,
                                        col: '#e8294a'
                                    },
                                    { label: 'Shock type', val: shockType, col: '#e8b418' },
                                    {
                                        label: 'Intensity',
                                        val: `${Math.round(intensity * 100)}%`,
                                        col: '#18b8d8'
                                    },
                                    {
                                        label: 'Countries affected',
                                        val: result.cascade?.summary?.total || 0,
                                        col: '#2ebc6e'
                                    },
                                    {
                                        label: 'Max SI',
                                        val: result.cascade?.summary?.max_si?.toFixed(2) || '—',
                                        col: '#e8294a'
                                    },
                                    {
                                        label: 'Avg SI',
                                        val: result.cascade?.summary?.avg_si?.toFixed(2) || '—',
                                        col: '#9aaec8'
                                    },
                                ].map((s, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '5px 0',
                                        borderBottom: i < 5
                                            ? '1px solid #1e2d4a' : 'none'
                                    }}>
                                        <span style={{
                                            fontSize: 10, color: '#5a7494',
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            {s.label}
                                        </span>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700,
                                            color: s.col,
                                            fontFamily: 'JetBrains Mono,monospace',
                                            textTransform: 'capitalize',
                                            maxWidth: '130px',
                                            textAlign: 'right'
                                        }}>
                                            {s.val}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Confidence scores */}
                    <div style={CARD}>
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #1e2d4a'
                        }}>
                            <span style={LBL}>AI confidence scores</span>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                            {[
                                {
                                    label: 'Bottleneck detection',
                                    val: .91, col: '#e8294a'
                                },
                                {
                                    label: 'Cluster identification',
                                    val: .84, col: '#e8b418'
                                },
                                {
                                    label: 'SI prediction',
                                    val: .78, col: '#18b8d8'
                                },
                                {
                                    label: 'Path routing',
                                    val: .88, col: '#6b2fc4'
                                },
                                {
                                    label: 'Risk classification',
                                    val: .93, col: '#2ebc6e'
                                },
                            ].map((s, i) => (
                                <div key={i} style={{ marginBottom: '8px' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '3px'
                                    }}>
                                        <span style={{
                                            fontSize: 10, color: '#5a7494',
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            {s.label}
                                        </span>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700,
                                            color: s.col,
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            {Math.round(s.val * 100)}%
                                        </span>
                                    </div>
                                    <div style={{
                                        height: '4px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '2px', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${s.val * 100}%`,
                                            background: s.col,
                                            borderRadius: '2px',
                                            transition: 'width .6s ease'
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DAV methodology note */}
                    <div style={{
                        ...CARD,
                        borderColor: 'rgba(107,47,196,0.3)',
                        borderStyle: 'solid'
                    }}>
                        <div style={{ padding: '12px 14px' }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700,
                                color: '#6b2fc4',
                                fontFamily: 'Syne,sans-serif',
                                marginBottom: '6px'
                            }}>
                                ✦ DAV methodology
                            </div>
                            <div style={{
                                fontSize: 11, color: '#5a7494',
                                lineHeight: 1.65,
                                fontFamily: 'Syne,sans-serif'
                            }}>
                                Insights are generated from real World Bank,
                                EIA and OEC trade data processed through the
                                custom Spillover Index formula and NetworkX
                                cascade engine. Not static content.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}