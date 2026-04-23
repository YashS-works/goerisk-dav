import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard'

export default function AnalyticsPage() {
    return (
        <div style={{ padding: '18px 24px', animation: 'fadeUp .35s ease both' }}>
            <div style={{
                display: 'inline-block',
                background: 'rgba(24,184,216,0.12)',
                border: '1px solid rgba(24,184,216,0.3)',
                color: '#18b8d8',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.1em',
                marginBottom: '8px'
            }}>
                03 · ANALYTICS
            </div>
            <h1 style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#e8eef8',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
            }}>
                Dynamic Analytics Dashboard
            </h1>
            <p style={{
                fontSize: '12px',
                color: '#5a7494',
                marginBottom: '16px',
                lineHeight: 1.6
            }}>
                Time-series SI trends, cross-domain spillover comparison,
                cascade heatmap and network analytics — all from live data.
            </p>
            <AnalyticsDashboard />
        </div>
    )
}