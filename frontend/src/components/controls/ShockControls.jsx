import useSimStore from '../../store/useSimStore'
import { simulationAPI } from '../../api/simulation'
import useDataStore from '../../store/useDataStore'

const SHOCK_TYPES = [
    { id: 'war', label: 'War', color: '#e8294a', bg: 'rgba(232,41,74,0.12)' },
    { id: 'sanctions', label: 'Sanctions', color: '#e8b418', bg: 'rgba(232,180,24,0.12)' },
    { id: 'supply', label: 'Supply cut', color: '#6b2fc4', bg: 'rgba(107,47,196,0.12)' },
]

const DOMAINS = [
    { id: 'energy', label: '⚡ Energy', color: '#18b8d8' },
    { id: 'trade', label: '🚢 Trade', color: '#2ebc6e' },
    { id: 'food', label: '🌾 Food', color: '#e8b418' },
]

const card = {
    background: '#0d1528',
    border: '1px solid #1e2d4a',
    borderTop: '1px solid #1e2d4a',
    borderBottom: '1px solid #1e2d4a',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap'
}

const lbl = {
    fontSize: '9px',
    fontWeight: 700,
    color: '#3a5070',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    marginBottom: '6px',
    fontFamily: 'JetBrains Mono, monospace'
}

export default function ShockControls() {
    const {
        selA, selB,
        shockType, setShockType,
        intensity, setIntensity,
        domain, setDomain,
        isRunning, setRunning,
        setResult, setError, canFire
    } = useSimStore()

    const { setSIScores } = useDataStore()

    async function handleFire() {
        if (!canFire()) return
        setRunning(true)
        try {
            const result = await simulationAPI.run(
                selA.code, selB.code,
                shockType, intensity, domain
            )
            setResult(result)
            if (result.global_si) setSIScores(result.global_si)
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div style={card}>
            {/* Shock type */}
            <div>
                <div style={lbl}>Shock type</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {SHOCK_TYPES.map(s => (
                        <button key={s.id}
                            onClick={() => setShockType(s.id)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'Syne, sans-serif',
                                background: shockType === s.id ? s.bg : 'transparent',
                                border: `1.5px solid ${shockType === s.id ? s.color : '#1e2d4a'}`,
                                color: shockType === s.id ? s.color : '#3a5070',
                                boxShadow: shockType === s.id ? `0 0 12px ${s.color}30` : 'none',
                                transition: 'all .18s'
                            }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Intensity */}
            <div>
                <div style={lbl}>
                    Intensity —{' '}
                    <span style={{ color: '#e8294a', fontFamily: 'JetBrains Mono' }}>
                        {Math.round(intensity * 100)}%
                    </span>
                </div>
                <input
                    type="range" min={0.1} max={1.0} step={0.05}
                    value={intensity}
                    onChange={e => setIntensity(parseFloat(e.target.value))}
                    style={{ width: '110px', accentColor: '#e8294a', cursor: 'pointer' }}
                />
            </div>

            {/* Domain */}
            <div>
                <div style={lbl}>Primary domain</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                    {DOMAINS.map(d => (
                        <button key={d.id}
                            onClick={() => setDomain(d.id)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'Syne, sans-serif',
                                background: domain === d.id
                                    ? `rgba(${d.id === 'energy' ? '24,184,216'
                                        : d.id === 'trade' ? '46,188,110'
                                            : '232,180,24'},.12)`
                                    : 'transparent',
                                border: `1px solid ${domain === d.id ? d.color : '#1e2d4a'}`,
                                color: domain === d.id ? d.color : '#3a5070',
                                transition: 'all .18s'
                            }}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selection */}
            <div>
                <div style={lbl}>Selection</div>
                <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: selA && selB ? '#e8eef8' : '#3a5070'
                }}>
                    {!selA && !selB && 'No countries selected'}
                    {selA && !selB && `${selA.name} selected ✓`}
                    {selA && selB && `${selA.name} ⚔ ${selB.name}`}
                </div>
            </div>

            {/* Buttons */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button
                    onClick={handleFire}
                    disabled={!canFire()}
                    style={{
                        padding: '9px 22px',
                        borderRadius: '9px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: canFire() ? 'pointer' : 'not-allowed',
                        fontFamily: 'Syne, sans-serif',
                        border: 'none',
                        background: canFire()
                            ? 'linear-gradient(135deg,#e8294a,#6b2fc4)'
                            : '#1e2d4a',
                        color: canFire() ? 'white' : '#3a5070',
                        boxShadow: canFire()
                            ? '0 0 20px rgba(232,41,74,0.35)'
                            : 'none',
                        transition: 'all .2s',
                        letterSpacing: '.02em'
                    }}
                >
                    {isRunning ? '⏳ Running...' : '▶ Fire Shock'}
                </button>
                <button
                    onClick={() => {
                        useSimStore.getState().reset()
                        window.dispatchEvent(new Event('resetMap'))
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Syne, sans-serif',
                        border: '1px solid #1e2d4a',
                        background: 'transparent',
                        color: '#5a7494',
                        transition: 'all .18s'
                    }}
                >
                    Reset
                </button>
            </div>
        </div>
    )
}