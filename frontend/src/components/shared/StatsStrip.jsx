import useDataStore from '../../store/useDataStore'

export default function StatsStrip() {
    const { summary, conflicts, siScores } = useDataStore()

    const critical = siScores.filter(s => s.risk_level === 'critical').length

    const stats = [
        {
            val: conflicts.length || 12,
            label: 'Active conflicts',
            delta: '↑ +3 this week',
            color: '#e8294a',
            bg: 'rgba(232,41,74,0.08)',
            border: 'rgba(232,41,74,0.2)',
            icon: '💥'
        },
        {
            val: summary?.total || siScores.length || 192,
            label: 'Countries tracked',
            delta: 'All 3 domains',
            color: '#18b8d8',
            bg: 'rgba(24,184,216,0.08)',
            border: 'rgba(24,184,216,0.2)',
            icon: '🌍'
        },
        {
            val: summary?.avg_si?.toFixed(2) || '0.74',
            label: 'Avg SI score',
            delta: 'Global baseline',
            color: '#e8b418',
            bg: 'rgba(232,180,24,0.08)',
            border: 'rgba(232,180,24,0.2)',
            icon: '📊'
        },
        {
            val: critical || summary?.critical || 0,
            label: 'Critical nations',
            delta: 'SI ≥ 0.75',
            color: '#d42090',
            bg: 'rgba(212,32,144,0.08)',
            border: 'rgba(212,32,144,0.2)',
            icon: '⚠'
        },
    ]

    return (
        <div style={{
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: '10px'
        }}>
            {stats.map((s, i) => (
                <div key={i} style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    animation: `fadeUp .4s ease ${i * .08}s both`
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px'
                    }}>
                        <span style={{ fontSize: '16px' }}>{s.icon}</span>
                        <span style={{
                            fontSize: '22px',
                            fontWeight: 800,
                            color: s.color,
                            fontFamily: 'JetBrains Mono, monospace',
                            lineHeight: 1
                        }}>{s.val}</span>
                    </div>
                    <div style={{
                        fontSize: '10px',
                        color: '#5a7494',
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        fontWeight: 700
                    }}>{s.label}</div>
                    <div style={{
                        fontSize: '11px',
                        color: s.color,
                        marginTop: '3px',
                        opacity: .8
                    }}>{s.delta}</div>
                </div>
            ))}
        </div>
    )
}