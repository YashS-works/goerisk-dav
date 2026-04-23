import TectonicScene from '../components/plates/TectonicScene'

export default function CascadePage() {
    return (
        <div style={{ padding: '18px 24px', animation: 'fadeUp .35s ease both' }}>
            <div style={{
                display: 'inline-block',
                background: 'rgba(46,188,110,0.12)',
                border: '1px solid rgba(46,188,110,0.3)',
                color: '#2ebc6e',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.1em',
                marginBottom: '8px'
            }}>
                02 · LAYER CASCADE
            </div>
            <h1 style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#e8eef8',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
            }}>
                Tectonic Plate Shock Propagation
            </h1>
            <p style={{
                fontSize: '12px',
                color: '#5a7494',
                marginBottom: '16px',
                lineHeight: 1.6
            }}>
                Three geological stacked planes — Energy, Trade, Food.
                A shock bolt drills through all layers with live SI scoring.
            </p>
            <TectonicScene />
        </div>
    )
}