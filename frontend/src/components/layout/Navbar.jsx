import { Link, useLocation } from 'react-router-dom'
import useXPStore from '../../store/useXPStore'

const TABS = [
    { path: '/', label: 'World Map', color: '#e8294a' },
    { path: '/cascade', label: 'Layer Cascade', color: '#2ebc6e' },
    { path: '/analytics', label: 'Analytics', color: '#18b8d8' },
    { path: '/network', label: 'Network', color: '#6b2fc4' },
    { path: '/vulnerability', label: 'Vulnerability', color: '#e8b418' },
    { path: '/quiz', label: 'Quiz', color: '#d42090' },
    { path: '/insights', label: 'AI Insights', color: '#18a89e' },
]

export default function Navbar() {
    const location = useLocation()
    const { xp, level } = useXPStore()
    const xpPct = ((xp % 500) / 500) * 100

    const activeTab = TABS.find(t => t.path === location.pathname)

    return (
        <nav style={{
            background: '#0a1020',
            borderBottom: '1px solid #1e2d4a',
            padding: '0 24px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 500,
            gap: '12px'
        }}>
            {/* Logo */}
            <Link to="/" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
                flexShrink: 0
            }}>
                <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg,#e8294a,#6b2fc4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(232,41,74,0.4)'
                }}>
                    <svg viewBox="0 0 14 14" fill="none" width="16" height="16">
                        <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5" />
                        <circle cx="7" cy="7" r="2" fill="white" />
                    </svg>
                </div>
                <span style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#e8eef8',
                    fontFamily: 'Syne, sans-serif',
                    letterSpacing: '-0.02em'
                }}>
                    Geo<span style={{ color: '#e8294a' }}>Risk</span>
                    {' '}<span style={{ color: '#5a7494', fontSize: '13px' }}>DAV</span>
                </span>
            </Link>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '2px',
                background: '#0d1528',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid #1e2d4a',
                overflowX: 'auto'
            }}>
                {TABS.map(tab => {
                    const active = location.pathname === tab.path
                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            style={{
                                padding: '5px 13px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: active ? 700 : 500,
                                color: active ? tab.color : '#5a7494',
                                background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                                boxShadow: active ? `0 0 12px ${tab.color}30` : 'none',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                transition: 'all .18s',
                                fontFamily: 'Syne, sans-serif',
                                border: active ? `1px solid ${tab.color}40` : '1px solid transparent'
                            }}
                        >
                            {tab.label}
                        </Link>
                    )
                })}
            </div>

            {/* XP strip */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0
            }}>
                <div style={{
                    background: 'rgba(107,47,196,0.2)',
                    border: '1px solid rgba(107,47,196,0.4)',
                    color: '#b48af0',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontFamily: 'JetBrains Mono, monospace'
                }}>
                    Lv {level}
                </div>
                <div style={{
                    width: '72px',
                    height: '4px',
                    background: '#162240',
                    borderRadius: '2px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${xpPct}%`,
                        background: 'linear-gradient(90deg,#e8294a,#6b2fc4)',
                        borderRadius: '2px',
                        transition: 'width .6s ease'
                    }} />
                </div>
                <span style={{
                    fontSize: '11px',
                    color: '#5a7494',
                    fontFamily: 'JetBrains Mono, monospace'
                }}>
                    {xp} XP
                </span>
            </div>
        </nav>
    )
}