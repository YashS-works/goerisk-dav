import { useEffect, useRef, useState, useCallback } from 'react'
import useSimStore from '../../store/useSimStore'
import useDataStore from '../../store/useDataStore'
import useBrushStore from '../../store/useBrushStore'
import { siToColor, siToOpacity } from '../../utils/colorScale'
import { simulationAPI } from '../../api/simulation'

// Precisely calibrated zones — image: 1746 x 901 px
const ZONES = [
    { code: 'CAN', name: 'Canada', x: 3.4, y: 2.8, w: 21.8, h: 18.3 },
    { code: 'USA', name: 'United States', x: 3.4, y: 20.5, w: 21.2, h: 15.0 },
    { code: 'MEX', name: 'Mexico', x: 4.9, y: 35.0, w: 12.0, h: 10.0 },
    { code: 'GRL', name: 'Greenland', x: 27.5, y: 1.7, w: 10.0, h: 12.2 },
    { code: 'CUB', name: 'Cuba', x: 14.0, y: 38.3, w: 4.3, h: 3.1 },
    { code: 'GTM', name: 'Guatemala', x: 7.4, y: 42.2, w: 2.9, h: 4.4 },
    { code: 'HND', name: 'Honduras', x: 9.7, y: 42.0, w: 3.2, h: 4.2 },
    { code: 'NIC', name: 'Nicaragua', x: 9.2, y: 45.5, w: 2.9, h: 3.9 },
    { code: 'CRI', name: 'Costa Rica', x: 8.5, y: 48.6, w: 2.6, h: 3.3 },
    { code: 'PAN', name: 'Panama', x: 10.9, y: 48.6, w: 2.9, h: 3.3 },
    { code: 'HTI', name: 'Haiti', x: 16.9, y: 39.4, w: 2.2, h: 3.1 },
    { code: 'DOM', name: 'Dominican Rep.', x: 18.9, y: 39.1, w: 2.4, h: 3.1 },
    { code: 'JAM', name: 'Jamaica', x: 15.6, y: 40.2, w: 1.8, h: 2.0 },
    { code: 'COL', name: 'Colombia', x: 11.7, y: 46.4, w: 6.3, h: 10.5 },
    { code: 'VEN', name: 'Venezuela', x: 16.9, y: 43.8, w: 6.3, h: 8.9 },
    { code: 'ECU', name: 'Ecuador', x: 11.5, y: 54.4, w: 4.1, h: 8.0 },
    { code: 'PER', name: 'Peru', x: 12.0, y: 56.6, w: 5.2, h: 15.5 },
    { code: 'BRA', name: 'Brazil', x: 17.5, y: 47.7, w: 13.7, h: 27.2 },
    { code: 'BOL', name: 'Bolivia', x: 15.5, y: 60.5, w: 5.2, h: 10.5 },
    { code: 'PRY', name: 'Paraguay', x: 18.0, y: 63.8, w: 3.7, h: 7.2 },
    { code: 'ARG', name: 'Argentina', x: 14.6, y: 65.5, w: 6.3, h: 24.4 },
    { code: 'CHL', name: 'Chile', x: 12.9, y: 62.7, w: 3.2, h: 29.4 },
    { code: 'URY', name: 'Uruguay', x: 19.2, y: 68.3, w: 3.2, h: 6.1 },
    { code: 'GUY', name: 'Guyana', x: 20.6, y: 46.1, w: 3.7, h: 7.2 },
    { code: 'SUR', name: 'Suriname', x: 23.8, y: 46.1, w: 3.2, h: 6.7 },
    { code: 'GBR', name: 'United Kingdom', x: 37.8, y: 14.4, w: 3.0, h: 8.3 },
    { code: 'IRL', name: 'Ireland', x: 36.1, y: 15.3, w: 2.4, h: 5.8 },
    { code: 'PRT', name: 'Portugal', x: 35.5, y: 23.9, w: 2.2, h: 7.2 },
    { code: 'ESP', name: 'Spain', x: 36.4, y: 22.8, w: 5.4, h: 8.9 },
    { code: 'FRA', name: 'France', x: 39.2, y: 18.6, w: 4.1, h: 8.9 },
    { code: 'DEU', name: 'Germany', x: 43.2, y: 14.4, w: 3.3, h: 8.9 },
    { code: 'ITA', name: 'Italy', x: 43.5, y: 21.6, w: 3.0, h: 12.8 },
    { code: 'NLD', name: 'Netherlands', x: 42.4, y: 13.9, w: 2.2, h: 4.2 },
    { code: 'BEL', name: 'Belgium', x: 40.4, y: 16.4, w: 2.2, h: 3.9 },
    { code: 'CHE', name: 'Switzerland', x: 42.1, y: 20.5, w: 2.3, h: 3.6 },
    { code: 'AUT', name: 'Austria', x: 44.1, y: 20.2, w: 2.4, h: 3.6 },
    { code: 'POL', name: 'Poland', x: 45.8, y: 13.3, w: 4.1, h: 7.2 },
    { code: 'CZE', name: 'Czech Republic', x: 45.1, y: 17.5, w: 2.7, h: 3.6 },
    { code: 'SVK', name: 'Slovakia', x: 47.4, y: 18.0, w: 2.3, h: 3.1 },
    { code: 'HUN', name: 'Hungary', x: 47.0, y: 20.5, w: 3.2, h: 3.6 },
    { code: 'ROU', name: 'Romania', x: 49.1, y: 19.1, w: 3.3, h: 5.8 },
    { code: 'BGR', name: 'Bulgaria', x: 49.4, y: 24.2, w: 3.0, h: 5.0 },
    { code: 'GRC', name: 'Greece', x: 47.3, y: 25.3, w: 3.2, h: 8.0 },
    { code: 'SWE', name: 'Sweden', x: 45.2, y: 6.1, w: 3.0, h: 13.9 },
    { code: 'NOR', name: 'Norway', x: 42.1, y: 5.3, w: 3.9, h: 12.0 },
    { code: 'FIN', name: 'Finland', x: 48.2, y: 5.0, w: 3.6, h: 10.9 },
    { code: 'DNK', name: 'Denmark', x: 43.6, y: 11.7, w: 2.0, h: 5.0 },
    { code: 'BLR', name: 'Belarus', x: 49.9, y: 13.1, w: 3.3, h: 5.8 },
    { code: 'LVA', name: 'Latvia', x: 49.1, y: 10.2, w: 2.4, h: 3.3 },
    { code: 'LTU', name: 'Lithuania', x: 48.6, y: 12.8, w: 2.2, h: 3.1 },
    { code: 'EST', name: 'Estonia', x: 49.0, y: 8.0, w: 2.2, h: 3.1 },
    { code: 'UKR', name: 'Ukraine', x: 50.5, y: 16.9, w: 5.6, h: 7.2 },
    { code: 'MDA', name: 'Moldova', x: 51.3, y: 22.2, w: 1.6, h: 3.1 },
    { code: 'RUS', name: 'Russia', x: 52.1, y: 3.3, w: 41.2, h: 16.4 },
    { code: 'TUR', name: 'Turkey', x: 50.7, y: 23.9, w: 6.9, h: 8.0 },
    { code: 'SYR', name: 'Syria', x: 54.3, y: 28.3, w: 3.0, h: 4.7 },
    { code: 'LBN', name: 'Lebanon', x: 53.7, y: 29.7, w: 1.6, h: 3.1 },
    { code: 'ISR', name: 'Israel', x: 53.7, y: 31.1, w: 1.4, h: 3.6 },
    { code: 'JOR', name: 'Jordan', x: 54.9, y: 30.9, w: 2.2, h: 5.3 },
    { code: 'IRQ', name: 'Iraq', x: 56.4, y: 26.9, w: 3.9, h: 8.9 },
    { code: 'IRN', name: 'Iran', x: 59.0, y: 22.8, w: 6.8, h: 13.1 },
    { code: 'SAU', name: 'Saudi Arabia', x: 55.3, y: 32.7, w: 7.9, h: 17.5 },
    { code: 'YEM', name: 'Yemen', x: 56.4, y: 46.4, w: 5.0, h: 6.7 },
    { code: 'OMN', name: 'Oman', x: 62.0, y: 35.0, w: 3.7, h: 9.8 },
    { code: 'ARE', name: 'UAE', x: 61.6, y: 35.7, w: 2.7, h: 4.7 },
    { code: 'KWT', name: 'Kuwait', x: 58.3, y: 30.9, w: 1.6, h: 3.1 },
    { code: 'QAT', name: 'Qatar', x: 60.6, y: 34.4, w: 1.0, h: 2.8 },
    { code: 'KAZ', name: 'Kazakhstan', x: 60.4, y: 10.2, w: 9.6, h: 14.4 },
    { code: 'UZB', name: 'Uzbekistan', x: 61.7, y: 20.5, w: 3.9, h: 6.9 },
    { code: 'TKM', name: 'Turkmenistan', x: 60.0, y: 23.9, w: 4.1, h: 5.8 },
    { code: 'KGZ', name: 'Kyrgyzstan', x: 65.0, y: 19.1, w: 2.7, h: 5.0 },
    { code: 'TJK', name: 'Tajikistan', x: 64.0, y: 22.8, w: 2.7, h: 5.0 },
    { code: 'AFG', name: 'Afghanistan', x: 62.3, y: 25.3, w: 5.0, h: 9.1 },
    { code: 'PAK', name: 'Pakistan', x: 62.1, y: 27.5, w: 5.0, h: 12.8 },
    { code: 'IND', name: 'India', x: 65.6, y: 29.7, w: 7.9, h: 23.1 },
    { code: 'NPL', name: 'Nepal', x: 67.6, y: 28.3, w: 3.0, h: 3.6 },
    { code: 'BTN', name: 'Bhutan', x: 70.3, y: 28.3, w: 1.6, h: 3.1 },
    { code: 'BGD', name: 'Bangladesh', x: 71.3, y: 30.2, w: 2.2, h: 5.8 },
    { code: 'LKA', name: 'Sri Lanka', x: 68.4, y: 48.6, w: 1.6, h: 5.0 },
    { code: 'CHN', name: 'China', x: 67.9, y: 13.1, w: 14.2, h: 30.2 },
    { code: 'MNG', name: 'Mongolia', x: 68.4, y: 8.0, w: 11.2, h: 9.8 },
    { code: 'PRK', name: 'North Korea', x: 80.6, y: 18.6, w: 2.7, h: 6.4 },
    { code: 'KOR', name: 'South Korea', x: 81.0, y: 24.4, w: 2.4, h: 5.3 },
    { code: 'JPN', name: 'Japan', x: 82.9, y: 16.1, w: 3.9, h: 18.0 },
    { code: 'TWN', name: 'Taiwan', x: 81.0, y: 30.9, w: 1.6, h: 4.7 },
    { code: 'MMR', name: 'Myanmar', x: 71.9, y: 29.7, w: 3.7, h: 13.1 },
    { code: 'THA', name: 'Thailand', x: 73.4, y: 35.3, w: 3.6, h: 10.9 },
    { code: 'LAO', name: 'Laos', x: 75.7, y: 30.5, w: 2.6, h: 9.1 },
    { code: 'VNM', name: 'Vietnam', x: 77.2, y: 30.2, w: 2.7, h: 15.0 },
    { code: 'KHM', name: 'Cambodia', x: 75.5, y: 38.0, w: 2.7, h: 5.8 },
    { code: 'MYS', name: 'Malaysia', x: 74.9, y: 43.1, w: 4.9, h: 6.9 },
    { code: 'IDN', name: 'Indonesia', x: 74.7, y: 47.5, w: 14.0, h: 13.1 },
    { code: 'PHL', name: 'Philippines', x: 80.9, y: 33.1, w: 3.6, h: 15.3 },
    { code: 'SGP', name: 'Singapore', x: 77.2, y: 47.7, w: 1.0, h: 2.0 },
    { code: 'MAR', name: 'Morocco', x: 36.0, y: 27.5, w: 3.7, h: 9.1 },
    { code: 'DZA', name: 'Algeria', x: 37.8, y: 28.3, w: 6.8, h: 16.4 },
    { code: 'LBY', name: 'Libya', x: 43.6, y: 27.2, w: 5.6, h: 14.7 },
    { code: 'TUN', name: 'Tunisia', x: 43.6, y: 24.4, w: 2.6, h: 5.3 },
    { code: 'EGY', name: 'Egypt', x: 49.1, y: 25.3, w: 5.6, h: 12.4 },
    { code: 'MRT', name: 'Mauritania', x: 33.1, y: 33.9, w: 4.9, h: 12.8 },
    { code: 'MLI', name: 'Mali', x: 37.5, y: 34.2, w: 6.0, h: 14.2 },
    { code: 'NER', name: 'Niger', x: 42.8, y: 33.9, w: 5.0, h: 12.8 },
    { code: 'TCD', name: 'Chad', x: 47.8, y: 34.2, w: 5.0, h: 12.4 },
    { code: 'SDN', name: 'Sudan', x: 52.4, y: 35.3, w: 5.0, h: 12.8 },
    { code: 'ETH', name: 'Ethiopia', x: 55.1, y: 40.8, w: 5.8, h: 12.4 },
    { code: 'SOM', name: 'Somalia', x: 59.5, y: 40.8, w: 4.7, h: 12.8 },
    { code: 'SEN', name: 'Senegal', x: 32.9, y: 42.0, w: 2.9, h: 5.5 },
    { code: 'GIN', name: 'Guinea', x: 33.5, y: 44.2, w: 2.7, h: 5.3 },
    { code: 'SLE', name: 'Sierra Leone', x: 33.8, y: 47.5, w: 2.0, h: 3.9 },
    { code: 'LBR', name: 'Liberia', x: 34.7, y: 48.8, w: 2.2, h: 4.2 },
    { code: 'CIV', name: "Cote d'Ivoire", x: 35.8, y: 47.5, w: 3.0, h: 5.8 },
    { code: 'GHA', name: 'Ghana', x: 37.8, y: 46.6, w: 2.2, h: 5.8 },
    { code: 'NGA', name: 'Nigeria', x: 40.8, y: 43.1, w: 5.0, h: 12.4 },
    { code: 'CMR', name: 'Cameroon', x: 44.6, y: 43.3, w: 3.0, h: 9.1 },
    { code: 'CAF', name: 'C. African Rep.', x: 47.1, y: 43.1, w: 5.0, h: 8.9 },
    { code: 'COD', name: 'DR Congo', x: 48.6, y: 48.3, w: 6.8, h: 16.4 },
    { code: 'COG', name: 'Congo', x: 45.8, y: 48.6, w: 3.0, h: 7.2 },
    { code: 'GAB', name: 'Gabon', x: 44.0, y: 49.1, w: 2.7, h: 7.2 },
    { code: 'AGO', name: 'Angola', x: 46.3, y: 56.0, w: 5.7, h: 13.1 },
    { code: 'ZMB', name: 'Zambia', x: 50.7, y: 57.7, w: 4.7, h: 9.1 },
    { code: 'ZWE', name: 'Zimbabwe', x: 52.6, y: 63.3, w: 2.7, h: 5.3 },
    { code: 'MOZ', name: 'Mozambique', x: 54.5, y: 56.4, w: 3.7, h: 14.7 },
    { code: 'TZA', name: 'Tanzania', x: 54.3, y: 48.6, w: 4.7, h: 10.5 },
    { code: 'KEN', name: 'Kenya', x: 56.7, y: 43.8, w: 3.6, h: 9.1 },
    { code: 'UGA', name: 'Uganda', x: 54.1, y: 45.0, w: 2.7, h: 5.3 },
    { code: 'RWA', name: 'Rwanda', x: 53.8, y: 48.8, w: 1.4, h: 3.1 },
    { code: 'SSD', name: 'South Sudan', x: 51.3, y: 39.7, w: 4.1, h: 7.5 },
    { code: 'BWA', name: 'Botswana', x: 49.3, y: 60.8, w: 3.7, h: 9.1 },
    { code: 'NAM', name: 'Namibia', x: 46.3, y: 60.2, w: 3.9, h: 10.9 },
    { code: 'ZAF', name: 'South Africa', x: 47.0, y: 66.4, w: 7.6, h: 14.2 },
    { code: 'MDG', name: 'Madagascar', x: 58.5, y: 56.4, w: 3.6, h: 18.0 },
    { code: 'AUS', name: 'Australia', x: 74.2, y: 56.0, w: 15.9, h: 32.0 },
    { code: 'NZL', name: 'New Zealand', x: 89.2, y: 67.5, w: 3.6, h: 14.4 },
    { code: 'PNG', name: 'Papua New Guinea', x: 82.9, y: 50.2, w: 5.0, h: 9.1 },
]

export default function WorldMap() {
    const containerRef = useRef(null)
    const [dims, setDims] = useState({ w: 1200, h: 620 })

    const { selA, selB, isRunning, shockType, intensity } = useSimStore()
    const { siMap, conflicts } = useDataStore()
    const { setHoveredCountry } = useBrushStore()

    const [hoveredCode, setHoveredCode] = useState(null)
    const [pins, setPins] = useState([])
    const [ripples, setRipples] = useState([])
    const [shockLine, setShockLine] = useState(null)
    const [affectedDots, setAffectedDots] = useState([])
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        function update() {
            if (containerRef.current) {
                const w = containerRef.current.offsetWidth
                // Maintain 1746:901 aspect ratio
                const h = Math.round(w * (901 / 1746))
                setDims({ w, h })
            }
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    useEffect(() => {
        window.addEventListener('resetMap', resetMap)
        return () => window.removeEventListener('resetMap', resetMap)
    }, [])

    // Convert % to SVG coordinates
    function p(xPct, yPct) {
        return { x: (xPct / 100) * dims.w, y: (yPct / 100) * dims.h }
    }

    function zoneCenter(zone) {
        return p(zone.x + zone.w / 2, zone.y + zone.h / 2)
    }

    function handleClick(zone) {
        if (isRunning) return
        const center = zoneCenter(zone)
        const store = useSimStore.getState()

        if (!store.selA) {
            store.setSelA({ code: zone.code, name: zone.name, ...center })
            dropPin(center.x, center.y, '#f97316', zone.name, 'A')
            addRipples(center.x, center.y, '#f97316')
        } else if (!store.selB && zone.code !== store.selA.code) {
            store.setSelB({ code: zone.code, name: zone.name, ...center })
            dropPin(center.x, center.y, '#ef4444', zone.name, 'B')
            addRipples(center.x, center.y, '#ef4444')
            drawLine(store.selA.x, store.selA.y, center.x, center.y)
            loadCascadeDots(store.selA.code)
        }
    }

    function dropPin(x, y, col, name, label) {
        setPins(prev => [...prev, {
            id: Date.now() + Math.random(), x, y, col, name, label
        }])
    }

    function addRipples(x, y, col) {
        const batch = Array.from({ length: 5 }, (_, i) => ({
            id: Date.now() + Math.random() + i, x, y, col, delay: i * 0.35
        }))
        setRipples(prev => [...prev, ...batch])
        setTimeout(() => {
            setRipples(prev => prev.filter(r => !batch.find(b => b.id === r.id)))
        }, 5000)
    }

    function drawLine(x1, y1, x2, y2) {
        setShockLine({ x1, y1, x2, y2 })
    }

    async function loadCascadeDots(originCode) {
        try {
            const sim = useSimStore.getState()
            const res = await simulationAPI.getCountryProfile(
                originCode, sim.shockType, sim.intensity
            )
            const cascade = res.cascade || {}
            const dots = []
            const colorMap = { t1: '#f59e0b', t2: '#f97316', t3: '#22c55e' }

            Object.entries({ t1: cascade.t1, t2: cascade.t2, t3: cascade.t3 })
                .forEach(([step, data]) => {
                    if (!data) return
                    Object.entries(data).forEach(([code, info]) => {
                        const zone = ZONES.find(z => z.code === code)
                        if (!zone) return
                        const c = zoneCenter(zone)
                        dots.push({
                            ...c, code, si: info.composite_si,
                            col: colorMap[step], step
                        })
                    })
                })
            setAffectedDots(dots)
        } catch (e) {
            console.error('Cascade dots error:', e)
        }
    }

    function resetMap() {
        setPins([])
        setRipples([])
        setShockLine(null)
        setAffectedDots([])
        setTooltip(null)
        setHoveredCode(null)
    }

    const selACode = selA?.code
    const selBCode = selB?.code

    return (
        <div style={{ padding: '0 24px 0' }}>
            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #1e2d4a',
                    height: dims.h,
                    background: '#050a14'
                }}
            >
                {/* The exact world map image */}
                <img
                    src="/world-map.png"
                    alt="World Map"
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block',
                        userSelect: 'none'
                    }}
                    draggable={false}
                />

                {/* SVG overlay — all interactions */}
                <svg
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    viewBox={`0 0 ${dims.w} ${dims.h}`}
                    preserveAspectRatio="xMidYMid slice"
                >
                    <defs>
                        <style>{`
              @keyframes ripOut2 {
                0%   { r:5px; opacity:1; stroke-width:2.5; }
                100% { r:62px; opacity:0; stroke-width:.3; }
              }
              @keyframes pinBounce {
                0%   { transform:translateY(-22px) scale(.5); opacity:0; }
                55%  { transform:translateY(3px) scale(1.1); }
                100% { transform:translateY(0) scale(1); opacity:1; }
              }
              @keyframes lineAppear {
                from { stroke-dashoffset:900; }
                to   { stroke-dashoffset:0; }
              }
              @keyframes dotAppear {
                from { opacity:0; r:0; }
                to   { opacity:.85; }
              }
              @keyframes conflictBeat {
                0%,100% { opacity:.55; r:5px; }
                50%     { opacity:1;   r:8px; }
              }
              @keyframes haloBreath {
                0%,100% { opacity:.18; }
                50%     { opacity:.45; }
              }
            `}</style>
                    </defs>

                    {/* ── SI HEAT LAYER — real data from backend ── */}
                    {ZONES.map(zone => {
                        const si = siMap[zone.code]
                        if (!si || si.composite_si < 0.08) return null
                        const tl = p(zone.x, zone.y)
                        const w = (zone.w / 100) * dims.w
                        const h = (zone.h / 100) * dims.h
                        return (
                            <rect key={`heat-${zone.code}`}
                                x={tl.x} y={tl.y} width={w} height={h} rx={3}
                                fill={siToColor(si.composite_si)}
                                opacity={siToOpacity(si.composite_si) * 0.38}
                                style={{ pointerEvents: 'none' }}
                            />
                        )
                    })}

                    {/* ── HOVER / CLICK ZONES ── */}
                    {ZONES.map(zone => {
                        const tl = p(zone.x, zone.y)
                        const w = (zone.w / 100) * dims.w
                        const h = (zone.h / 100) * dims.h
                        const isHov = hoveredCode === zone.code
                        const isA = zone.code === selACode
                        const isB = zone.code === selBCode
                        const si = siMap[zone.code]

                        return (
                            <rect key={`zone-${zone.code}`}
                                x={tl.x} y={tl.y} width={w} height={h} rx={3}
                                fill={
                                    isA ? 'rgba(249,115,22,0.22)' :
                                        isB ? 'rgba(239,68,68,0.22)' :
                                            isHov ? 'rgba(255,255,255,0.14)' : 'transparent'
                                }
                                stroke={
                                    isA ? '#f97316' :
                                        isB ? '#ef4444' :
                                            isHov ? 'rgba(255,255,255,0.55)' : 'transparent'
                                }
                                strokeWidth={isA || isB ? 2 : 1}
                                style={{ cursor: 'pointer', transition: 'all .12s' }}
                                onMouseEnter={e => {
                                    setHoveredCode(zone.code)
                                    setHoveredCountry(zone.code)
                                    const rect = containerRef.current?.getBoundingClientRect()
                                    setTooltip({
                                        x: e.clientX - (rect?.left || 0),
                                        y: e.clientY - (rect?.top || 0),
                                        code: zone.code,
                                        name: zone.name,
                                        si: si?.composite_si,
                                        energy: si?.energy_si,
                                        trade: si?.trade_si,
                                        food: si?.food_si,
                                        risk: si?.risk_level
                                    })
                                }}
                                onMouseLeave={() => {
                                    setHoveredCode(null)
                                    setHoveredCountry(null)
                                    setTooltip(null)
                                }}
                                onClick={() => handleClick(zone)}
                            />
                        )
                    })}

                    {/* ── LIVE CONFLICT MARKERS from real ACLED/fallback data ── */}
                    {conflicts.map((c, i) => {
                        const zone = ZONES.find(z =>
                            z.name.toLowerCase()
                                .includes(c.country.toLowerCase().split(' ')[0]) ||
                            c.country.toLowerCase()
                                .includes(z.name.toLowerCase().split(' ')[0])
                        )
                        if (!zone) return null
                        const center = zoneCenter(zone)
                        return (
                            <g key={`conflict-${i}`}>
                                <circle cx={center.x} cy={center.y} r={5}
                                    fill="#e8294a"
                                    style={{
                                        animation: `conflictBeat 2s ease-in-out ${i * .2}s infinite`
                                    }}
                                />
                                <circle cx={center.x} cy={center.y} r={2.5}
                                    fill="white" opacity={.9}
                                />
                            </g>
                        )
                    })}

                    {/* ── RIPPLE RINGS ── */}
                    {ripples.map(r => (
                        <circle key={r.id}
                            cx={r.x} cy={r.y} r={5}
                            fill="none" stroke={r.col} strokeWidth={2}
                            style={{
                                animation: `ripOut2 1.5s ease-out ${r.delay}s forwards`
                            }}
                        />
                    ))}

                    {/* ── SHOCK LINE ── */}
                    {shockLine && (() => {
                        const dx = shockLine.x2 - shockLine.x1
                        const dy = shockLine.y2 - shockLine.y1
                        const d = Math.hypot(dx, dy)
                        return (
                            <g>
                                <line
                                    x1={shockLine.x1} y1={shockLine.y1}
                                    x2={shockLine.x2} y2={shockLine.y2}
                                    stroke="#e8294a" strokeWidth={2}
                                    strokeDasharray={d} strokeDashoffset={d}
                                    opacity={.75}
                                    style={{ animation: 'lineAppear .9s ease-out .2s forwards' }}
                                />
                                <circle
                                    cx={(shockLine.x1 + shockLine.x2) / 2}
                                    cy={(shockLine.y1 + shockLine.y2) / 2}
                                    r={5} fill="#e8294a" opacity={.6}
                                />
                            </g>
                        )
                    })()}

                    {/* ── AFFECTED CASCADE DOTS — real from backend ── */}
                    {affectedDots.map((d, i) => (
                        <g key={`dot-${i}`}>
                            <circle cx={d.x} cy={d.y} r={14}
                                fill={d.col} opacity={0}
                                style={{
                                    animation: `haloBreath 2s ease-in-out ${i * .1}s infinite`,
                                    opacity: .2
                                }}
                            />
                            <circle cx={d.x} cy={d.y} r={5}
                                fill={d.col} opacity={0}
                                style={{
                                    animation: `dotAppear .4s ease-out ${i * .12 + .3}s forwards`
                                }}
                            />
                            <rect x={d.x + 8} y={d.y - 11} width={36} height={14} rx={7}
                                fill="rgba(13,21,40,.9)"
                            />
                            <text x={d.x + 26} y={d.y}
                                textAnchor="middle" fontSize={8} fontWeight="700"
                                fontFamily="JetBrains Mono, monospace"
                                fill={d.col}
                            >
                                {d.si?.toFixed(2)}
                            </text>
                        </g>
                    ))}

                    {/* ── PIN MARKERS ── */}
                    {pins.map(pin => (
                        <g key={pin.id}
                            style={{ animation: 'pinBounce .55s cubic-bezier(.34,1.56,.64,1) both' }}
                        >
                            <ellipse cx={pin.x} cy={pin.y} rx={24} ry={15}
                                fill={pin.col} opacity={.18}
                            />
                            <rect x={pin.x - 38} y={pin.y - 34} width={76} height={20} rx={10}
                                fill="rgba(13,21,40,.92)"
                                stroke={pin.col} strokeWidth={1.5}
                            />
                            <text x={pin.x} y={pin.y - 21}
                                textAnchor="middle" fontSize={10} fontWeight="700"
                                fontFamily="Syne, sans-serif" fill={pin.col}
                            >
                                {pin.name.length > 13
                                    ? pin.name.slice(0, 11) + '…' : pin.name}
                            </text>
                            <circle cx={pin.x} cy={pin.y} r={8} fill={pin.col} />
                            <circle cx={pin.x} cy={pin.y} r={3.5} fill="white" />
                            <text x={pin.x + 12} y={pin.y + 4}
                                fontSize={10} fontWeight="800"
                                fontFamily="Syne, sans-serif"
                                fill="white"
                            >
                                {pin.label}
                            </text>
                        </g>
                    ))}
                </svg>

                {/* Instruction pill */}
                <div style={{
                    position: 'absolute', top: '10px',
                    left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(13,21,40,.88)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(232,41,74,.3)',
                    borderRadius: '20px',
                    padding: '5px 16px',
                    fontSize: '11px', fontWeight: 600,
                    color: '#9aaec8',
                    whiteSpace: 'nowrap', zIndex: 10,
                    fontFamily: 'Syne, sans-serif',
                    display: !selACode && !selBCode ? 'block' : 'none'
                }}>
                    🌍 Click any country to mark Conflict Party A
                </div>

                {selACode && !selBCode && (
                    <div style={{
                        position: 'absolute', top: '10px',
                        left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(249,115,22,.15)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(249,115,22,.4)',
                        borderRadius: '20px',
                        padding: '5px 16px',
                        fontSize: '11px', fontWeight: 600,
                        color: '#fb923c',
                        whiteSpace: 'nowrap', zIndex: 10,
                        fontFamily: 'Syne, sans-serif'
                    }}>
                        ✓ {selA?.name} selected — now click Country B
                    </div>
                )}

                {/* Conflict badge */}
                {selACode && selBCode && (
                    <div style={{
                        position: 'absolute', top: '10px', right: '12px',
                        background: 'rgba(232,41,74,.12)',
                        backdropFilter: 'blur(6px)',
                        border: '1.5px solid rgba(232,41,74,.4)',
                        borderRadius: '10px',
                        padding: '8px 12px', zIndex: 10
                    }}>
                        <div style={{
                            fontSize: 9, fontWeight: 700, color: '#e8294a',
                            letterSpacing: '.1em', marginBottom: '2px',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            ACTIVE CONFLICT
                        </div>
                        <div style={{
                            fontSize: 13, fontWeight: 700, color: '#e8eef8',
                            fontFamily: 'Syne, sans-serif'
                        }}>
                            {selA?.name} ⚔ {selB?.name}
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div style={{
                    position: 'absolute', bottom: '10px', left: '12px',
                    background: 'rgba(13,21,40,.88)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid #1e2d4a',
                    borderRadius: '10px',
                    padding: '8px 12px', zIndex: 10
                }}>
                    {[
                        { col: '#f97316', label: 'Party A — origin' },
                        { col: '#ef4444', label: 'Party B — conflict' },
                        { col: '#f59e0b', label: 't₁ energy cascade' },
                        { col: '#f97316', label: 't₂ trade cascade' },
                        { col: '#22c55e', label: 't₃ food cascade' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center',
                            gap: '6px', marginBottom: i < 4 ? '4px' : 0,
                            fontSize: 10, fontWeight: 500, color: '#9aaec8',
                            fontFamily: 'Syne, sans-serif'
                        }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: item.col, flexShrink: 0
                            }} />
                            {item.label}
                        </div>
                    ))}
                </div>

                {/* Reset */}
                {(selACode || selBCode) && (
                    <button
                        onClick={resetMap}
                        style={{
                            position: 'absolute', bottom: '10px', right: '12px',
                            background: 'rgba(13,21,40,.88)',
                            backdropFilter: 'blur(6px)',
                            border: '1px solid #2a3d5e',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '11px', fontWeight: 600,
                            color: '#5a7494', cursor: 'pointer',
                            zIndex: 10,
                            fontFamily: 'Syne, sans-serif',
                            transition: 'all .18s'
                        }}
                    >
                        ✕ Reset
                    </button>
                )}
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'fixed',
                    left: containerRef.current?.getBoundingClientRect().left
                        + tooltip.x + 14,
                    top: containerRef.current?.getBoundingClientRect().top
                        + tooltip.y - 55,
                    background: '#0d1528',
                    border: '1px solid #1e2d4a',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    pointerEvents: 'none',
                    zIndex: 999,
                    minWidth: '155px',
                    boxShadow: '0 8px 24px rgba(0,0,0,.5)'
                }}>
                    <div style={{
                        fontSize: 12, fontWeight: 700,
                        color: '#e8eef8', marginBottom: '5px',
                        fontFamily: 'Syne, sans-serif'
                    }}>
                        {tooltip.name}
                    </div>
                    {tooltip.si !== undefined && (
                        <>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                gap: '5px', marginBottom: '6px'
                            }}>
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: siToColor(tooltip.si)
                                }} />
                                <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    color: siToColor(tooltip.si),
                                    fontFamily: 'JetBrains Mono, monospace'
                                }}>
                                    SI {tooltip.si.toFixed(2)}
                                </span>
                                <span style={{
                                    fontSize: 10, color: '#5a7494',
                                    textTransform: 'capitalize'
                                }}>
                                    — {tooltip.risk}
                                </span>
                            </div>
                            {[
                                { icon: '⚡', val: tooltip.energy, col: '#18b8d8' },
                                { icon: '🚢', val: tooltip.trade, col: '#2ebc6e' },
                                { icon: '🌾', val: tooltip.food, col: '#e8b418' },
                            ].map((d, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center',
                                    gap: '5px', marginBottom: '3px'
                                }}>
                                    <span style={{ fontSize: '10px' }}>{d.icon}</span>
                                    <div style={{
                                        flex: 1, height: '3px',
                                        background: 'rgba(255,255,255,.06)',
                                        borderRadius: '2px', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(d.val || 0) * 100}%`,
                                            background: d.col
                                        }} />
                                    </div>
                                    <span style={{
                                        fontSize: '9px', color: d.col,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        width: '26px', textAlign: 'right'
                                    }}>
                                        {(d.val || 0).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </>
                    )}
                    {tooltip.si === undefined && (
                        <div style={{
                            fontSize: 10, color: '#3a5070',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            No SI data yet — run simulation
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}