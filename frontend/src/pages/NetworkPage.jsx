import NetworkGraph from '../components/network/NetworkGraph'

export default function NetworkPage() {
    return (
        <div style={{ padding: '18px 24px', animation: 'fadeUp .35s ease both' }}>
            <div style={{
                display: 'inline-block',
                background: 'rgba(107,47,196,0.12)',
                border: '1px solid rgba(107,47,196,0.3)',
                color: '#6b2fc4',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.1em',
                marginBottom: '8px'
            }}>
                04 · NETWORK
            </div>
            <h1 style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#e8eef8',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
            }}>
                Global Dependency Network
            </h1>
            <p style={{
                fontSize: '12px',
                color: '#5a7494',
                marginBottom: '16px',
                lineHeight: 1.6
            }}>
                Force-directed graph of trade and energy linkages.
                Node size = centrality. Color = SI severity.
                Edge thickness = dependency weight.
            </p>
            <NetworkGraph />
        </div>
    )
}