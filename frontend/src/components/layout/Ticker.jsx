import { useEffect, useState } from 'react'
import useDataStore from '../../store/useDataStore'

export default function Ticker() {
    const { conflicts, siScores } = useDataStore()
    const [items, setItems] = useState([])

    useEffect(() => {
        const base = [
            { type: 'e', text: '⚡ Germany Energy SI: 0.88 — CRITICAL' },
            { type: 't', text: '🚢 South Korea Trade SI rising to 0.79' },
            { type: 'f', text: '🌾 Egypt food SI: 0.82 — wheat imports at risk' },
            { type: 'p', text: '📊 GeoRisk DAV: 192 countries tracked across 3 domains' },
            { type: 'a', text: '🌐 Network analysis: 14 critical bottleneck nodes identified' },
        ]

        const conflictItems = conflicts.slice(0, 6).map(c => ({
            type: 'r',
            text: `💥 ${c.country}: ${c.type} — ${c.fatalities} fatalities recorded`
        }))

        const siItems = siScores
            .filter(s => s.composite_si >= 0.70)
            .slice(0, 4)
            .map(s => ({
                type: 'e',
                text: `⚠ ${s.country_code} Composite SI: ${s.composite_si.toFixed(2)} — ${s.risk_level?.toUpperCase()}`
            }))

        setItems([...base, ...conflictItems, ...siItems])
    }, [conflicts, siScores])

    const colorMap = {
        e: '#18b8d8',  // energy — cyan
        t: '#2ebc6e',  // trade — green
        f: '#e8b418',  // food — gold
        r: '#e8294a',  // conflict — red
        p: '#6b2fc4',  // platform — purple
        a: '#18a89e',  // analytics — teal
    }

    const doubled = [...items, ...items]

    return (
        <div style={{
            background: '#050a14',
            borderBottom: '1px solid #1e2d4a',
            overflow: 'hidden',
            height: '28px',
            display: 'flex',
            alignItems: 'center'
        }}>
            <div
                style={{
                    whiteSpace: 'nowrap',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '10px',
                    color: '#3a5070',
                    animation: 'ticker 45s linear infinite',
                    display: 'inline-block'
                }}
            >
                {doubled.map((item, i) => (
                    <span key={i}>
                        <span style={{ padding: '0 32px', color: '#1e2d4a' }}>◆</span>
                        <span style={{ color: colorMap[item.type] || '#5a7494' }}>
                            {item.text}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    )
}