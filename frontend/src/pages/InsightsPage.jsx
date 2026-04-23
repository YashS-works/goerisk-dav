import AIInsights from '../components/ai/AIInsights'

export default function InsightsPage() {
    return (
        <div style={{ padding: '18px 24px', animation: 'fadeUp .35s ease both' }}>
            <div style={{
                display: 'inline-block',
                background: 'rgba(24,168,158,0.12)',
                border: '1px solid rgba(24,168,158,0.3)',
                color: '#18a89e',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.1em',
                marginBottom: '8px'
            }}>
                07 · AI INSIGHTS
            </div>
            <h1 style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#e8eef8',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
            }}>
                AI Intelligence — Pattern Detection
            </h1>
            <p style={{
                fontSize: '12px',
                color: '#5a7494',
                marginBottom: '16px',
                lineHeight: 1.6
            }}>
                AI-generated risk insights from network topology,
                cascade simulation data and historical spillover patterns.
            </p>
            <AIInsights />
        </div>
    )
}