import { useState, useEffect } from 'react'
import useXPStore from '../../store/useXPStore'
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

const FALLBACK_QUESTIONS = [
    {
        domain: 'Energy domain',
        question: 'When Russia cuts gas exports by 50%, which EU country has the highest energy SI?',
        options: ['France', 'Germany', 'Spain', 'Norway'],
        correct_index: 1,
        explanation: 'Germany has the highest energy import dependency in the EU, making it most vulnerable to Russian gas cuts with an SI of 0.88.',
        xp: 75
    },
    {
        domain: 'Trade domain',
        question: 'Which layer is FIRST affected when energy exports drop significantly?',
        options: ['Food layer directly', 'Trade layer', 'Military budgets', 'No cross-layer effect'],
        correct_index: 1,
        explanation: 'Energy disruptions immediately impact trade routes and logistics costs before flowing through to food supply chains.',
        xp: 75
    },
    {
        domain: 'Food domain',
        question: "Egypt's high food vulnerability SI of 0.82 is primarily driven by:",
        options: ['Domestic conflict only', 'Dependence on Ukrainian wheat', 'Water scarcity alone', 'Overpopulation'],
        correct_index: 1,
        explanation: 'Egypt imports over 80% of its wheat, mostly from Ukraine and Russia, making it critically exposed to any Eastern European conflict.',
        xp: 100
    },
    {
        domain: 'Spillover Index',
        question: 'A Spillover Index (SI) value of 0.88 means the country is:',
        options: ['88% GDP from exports', 'Critically vulnerable to cross-domain shocks', 'Has 88 active trade routes', 'Classified as low risk'],
        correct_index: 1,
        explanation: 'SI ≥ 0.75 is classified as Critical — meaning the country faces severe cross-domain cascade vulnerability from geopolitical shocks.',
        xp: 100
    },
    {
        domain: 'Cascade Model',
        question: 'In a t₀→t₃ propagation model, peak food insecurity typically occurs at:',
        options: ['t₀ — immediate', 't₁ — energy layer', 't₂ — trade layer', 't₃ — full cascade'],
        correct_index: 3,
        explanation: 'Food layer is the last to be affected as shocks propagate through energy first, then trade, before finally reaching food supply chains at t₃.',
        xp: 125
    }
]

export default function QuizPanel() {
    const {
        xp, level, correct, badges,
        questions, currentQ, answers, quizComplete,
        addXP, answerQuestion, setQuestions,
        nextQuestion, prevQuestion, checkBadges
    } = useXPStore()

    const { result, selA, selB, shockType } = useSimStore()

    const [loading, setLoading] = useState(false)
    const [leaderboard, setLeaderboard] = useState([])
    const [userName, setUserName] = useState(
        localStorage.getItem('georisk_name') || ''
    )
    const [nameInput, setNameInput] = useState('')
    const [showName, setShowName] = useState(false)
    const [showExpl, setShowExpl] = useState(false)

    const xpPct = ((xp % 500) / 500) * 100

    useEffect(() => {
        loadLeaderboard()
        if (questions.length === 0) {
            setQuestions(FALLBACK_QUESTIONS)
        }
    }, [])

    // Auto-generate questions when simulation runs
    useEffect(() => {
        if (result) generateFromSim()
    }, [result])

    async function generateFromSim() {
        try {
            setLoading(true)
            const res = await quizAPI.generate({
                country_a: selA?.code || 'IND',
                country_b: selB?.code || 'PAK',
                shock_type: shockType,
                intensity: useSimStore.getState().intensity,
                cascade: result?.cascade || {},
                country_b_si: result?.country_b_si || {}
            })
            if (res.questions?.length > 0) {
                setQuestions(res.questions)
            }
        } catch (e) {
            console.error('Quiz gen error:', e)
        } finally {
            setLoading(false)
        }
    }

    async function loadLeaderboard() {
        try {
            const res = await quizAPI.getLeaderboard()
            setLeaderboard(res.leaderboard || [])
        } catch (e) {
            console.error('Leaderboard error:', e)
        }
    }

    async function submitScore() {
        if (!userName) { setShowName(true); return }
        try {
            await quizAPI.updateScore(userName, xp)
            await loadLeaderboard()
        } catch (e) {
            console.error('Score submit error:', e)
        }
    }

    function handleSaveName() {
        if (!nameInput.trim()) return
        const name = nameInput.trim()
        setUserName(name)
        localStorage.setItem('georisk_name', name)
        setShowName(false)
        submitScoreWithName(name)
    }

    async function submitScoreWithName(name) {
        try {
            await quizAPI.updateScore(name, xp)
            await loadLeaderboard()
        } catch (e) {
            console.error('Score submit error:', e)
        }
    }

    function handleAnswer(optIdx) {
        const q = questions[currentQ]
        if (!q || answers[currentQ] !== undefined) return
        const isCorrect = optIdx === q.correct_index
        answerQuestion(currentQ, optIdx, isCorrect)
        if (isCorrect) {
            addXP(q.xp || 75)
            checkBadges()
        }
        setShowExpl(true)
        // Auto advance after 2.5s
        setTimeout(() => {
            setShowExpl(false)
            if (currentQ < questions.length - 1) {
                nextQuestion()
            }
        }, 2500)
    }

    const q = questions[currentQ]
    const KEYS = ['A', 'B', 'C', 'D']
    const answered = answers[currentQ] !== undefined

    const badgeDefs = [
        { id: 'energy', icon: '⚡', name: 'Energy Analyst', thresh: 1, col: '#18b8d8' },
        { id: 'trade', icon: '🚢', name: 'Trade Explorer', thresh: 2, col: '#2ebc6e' },
        { id: 'food', icon: '🌾', name: 'Food Defender', thresh: 3, col: '#e8b418' },
        { id: 'shock', icon: '💥', name: 'Shock Master', thresh: 5, col: '#e8294a' },
        { id: 'analyst', icon: '🌐', name: 'DAV Analyst', thresh: 10, col: '#6b2fc4' },
    ]

    const domainColors = {
        'Energy domain': '#18b8d8',
        'Trade domain': '#2ebc6e',
        'Food domain': '#e8b418',
        'Spillover Index': '#6b2fc4',
        'Cascade Model': '#e8294a',
    }

    return (
        <div style={{ paddingBottom: '24px' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr',
                gap: '14px'
            }}>

                {/* Left — Quiz */}
                <div>
                    {/* Progress dots */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px'
                    }}>
                        <span style={{
                            fontSize: 11, color: '#5a7494', fontWeight: 500,
                            fontFamily: 'JetBrains Mono,monospace'
                        }}>
                            Question {currentQ + 1} of {questions.length}
                        </span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {questions.map((_, i) => {
                                const ans = answers[i]
                                const ok = ans !== undefined
                                    && ans === questions[i]?.correct_index
                                const fail = ans !== undefined
                                    && ans !== questions[i]?.correct_index
                                return (
                                    <div key={i} style={{
                                        width: 9, height: 9, borderRadius: '50%',
                                        background: ok ? '#2ebc6e'
                                            : fail ? '#e8294a'
                                                : i === currentQ
                                                    ? '#9aaec8' : '#1e2d4a',
                                        border: `1px solid ${ok ? '#2ebc6e'
                                                : fail ? '#e8294a'
                                                    : i === currentQ
                                                        ? '#9aaec8' : '#1e2d4a'
                                            }`,
                                        boxShadow: (ok || fail || i === currentQ)
                                            ? `0 0 6px ${ok ? '#2ebc6e' : fail ? '#e8294a' : '#9aaec8'
                                            }60` : 'none',
                                        transition: 'all .3s'
                                    }} />
                                )
                            })}
                        </div>
                    </div>

                    {/* Question card */}
                    {loading ? (
                        <div style={{
                            ...CARD,
                            padding: '32px',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: 24, marginBottom: '12px'
                            }}>⏳</div>
                            <div style={{
                                fontSize: 13, color: '#5a7494',
                                fontFamily: 'Syne,sans-serif'
                            }}>
                                Generating questions from your simulation...
                            </div>
                        </div>
                    ) : q ? (
                        <div style={CARD}>
                            {/* Domain label */}
                            <div style={{
                                padding: '10px 16px',
                                borderBottom: '1px solid #1e2d4a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 700,
                                    letterSpacing: '.1em',
                                    textTransform: 'uppercase',
                                    fontFamily: 'JetBrains Mono,monospace',
                                    color: domainColors[q.domain] || '#9aaec8'
                                }}>
                                    {q.domain}
                                </span>
                                <span style={{
                                    fontSize: 9, fontWeight: 700,
                                    color: '#3a5070',
                                    fontFamily: 'JetBrains Mono,monospace'
                                }}>
                                    +{q.xp || 75} XP
                                </span>
                            </div>

                            <div style={{ padding: '16px' }}>
                                {/* Question text */}
                                <div style={{
                                    fontSize: 15, fontWeight: 700,
                                    color: '#e8eef8',
                                    lineHeight: 1.55,
                                    marginBottom: '16px',
                                    fontFamily: 'Syne,sans-serif'
                                }}>
                                    {q.question}
                                </div>

                                {/* Options */}
                                {q.options?.map((opt, i) => {
                                    const isAns = answers[currentQ] === i
                                    const isCorrect = i === q.correct_index
                                    const showResult = answered

                                    let bg = 'transparent'
                                    let border = '#1e2d4a'
                                    let col = '#9aaec8'
                                    let shadow = 'none'

                                    if (showResult) {
                                        if (isCorrect) {
                                            bg = 'rgba(46,188,110,0.12)'
                                            border = '#2ebc6e'
                                            col = '#2ebc6e'
                                            shadow = '0 0 12px rgba(46,188,110,0.2)'
                                        } else if (isAns) {
                                            bg = 'rgba(232,41,74,0.12)'
                                            border = '#e8294a'
                                            col = '#e8294a'
                                        } else {
                                            col = '#3a5070'
                                        }
                                    }

                                    return (
                                        <div key={i}
                                            onClick={() => !answered && handleAnswer(i)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                border: `1.5px solid ${border}`,
                                                marginBottom: '8px',
                                                cursor: answered ? 'default' : 'pointer',
                                                background: bg,
                                                boxShadow: shadow,
                                                transition: 'all .18s',
                                                opacity: showResult && !isCorrect && !isAns
                                                    ? .5 : 1
                                            }}
                                            onMouseEnter={e => {
                                                if (!answered) {
                                                    e.currentTarget.style.borderColor = '#2a3d5e'
                                                    e.currentTarget.style.background =
                                                        'rgba(255,255,255,0.03)'
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!answered) {
                                                    e.currentTarget.style.borderColor = '#1e2d4a'
                                                    e.currentTarget.style.background = 'transparent'
                                                }
                                            }}
                                        >
                                            {/* Key badge */}
                                            <div style={{
                                                width: 24, height: 24,
                                                borderRadius: '50%',
                                                border: `1.5px solid ${showResult && isCorrect ? '#2ebc6e'
                                                        : showResult && isAns ? '#e8294a'
                                                            : '#2a3d5e'
                                                    }`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 9, fontWeight: 700,
                                                flexShrink: 0,
                                                color: col,
                                                background: showResult && isCorrect
                                                    ? 'rgba(46,188,110,0.2)'
                                                    : showResult && isAns
                                                        ? 'rgba(232,41,74,0.2)'
                                                        : 'transparent',
                                                fontFamily: 'JetBrains Mono,monospace'
                                            }}>
                                                {showResult && isCorrect ? '✓'
                                                    : showResult && isAns ? '✗'
                                                        : KEYS[i]}
                                            </div>

                                            <span style={{
                                                fontSize: 12, color: col,
                                                fontFamily: 'Syne,sans-serif',
                                                fontWeight: showResult && isCorrect
                                                    ? 700 : 500
                                            }}>
                                                {opt}
                                            </span>
                                        </div>
                                    )
                                })}

                                {/* XP toast */}
                                {answered && (
                                    <div style={{
                                        marginTop: '10px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        background: answers[currentQ] === q.correct_index
                                            ? 'rgba(46,188,110,0.12)'
                                            : 'rgba(232,41,74,0.12)',
                                        border: `1px solid ${answers[currentQ] === q.correct_index
                                                ? 'rgba(46,188,110,0.3)'
                                                : 'rgba(232,41,74,0.3)'
                                            }`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ fontSize: '16px' }}>
                                            {answers[currentQ] === q.correct_index
                                                ? '🎉' : '💡'}
                                        </span>
                                        <div>
                                            <div style={{
                                                fontSize: 11, fontWeight: 700,
                                                color: answers[currentQ] === q.correct_index
                                                    ? '#2ebc6e' : '#e8294a',
                                                fontFamily: 'Syne,sans-serif'
                                            }}>
                                                {answers[currentQ] === q.correct_index
                                                    ? `+${q.xp || 75} XP — Correct!`
                                                    : 'Incorrect — learn from this'}
                                            </div>
                                            {showExpl && q.explanation && (
                                                <div style={{
                                                    fontSize: 11, color: '#9aaec8',
                                                    marginTop: '3px', lineHeight: 1.5
                                                }}>
                                                    {q.explanation}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/* Navigation */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '10px',
                        gap: '8px'
                    }}>
                        <button
                            onClick={prevQuestion}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'Syne,sans-serif',
                                border: '1px solid #1e2d4a',
                                background: 'transparent',
                                color: '#5a7494',
                                transition: 'all .18s'
                            }}
                        >
                            ← Prev
                        </button>

                        <button
                            onClick={generateFromSim}
                            disabled={!result || loading}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: result ? 'pointer' : 'not-allowed',
                                fontFamily: 'Syne,sans-serif',
                                border: '1px solid #1e2d4a',
                                background: 'transparent',
                                color: result ? '#18b8d8' : '#3a5070',
                                transition: 'all .18s'
                            }}
                        >
                            ↺ Regenerate from simulation
                        </button>

                        <button
                            onClick={nextQuestion}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'Syne,sans-serif',
                                border: '1px solid #1e2d4a',
                                background: 'transparent',
                                color: '#5a7494',
                                transition: 'all .18s'
                            }}
                        >
                            Next →
                        </button>
                    </div>

                    {/* Badges */}
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ ...LBL, marginBottom: '10px' }}>
                            Badges unlocked
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {badgeDefs.map((b, i) => {
                                const earned = correct >= b.thresh
                                return (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '5px 12px',
                                        borderRadius: '20px',
                                        border: `1.5px solid ${earned ? b.col : '#1e2d4a'
                                            }`,
                                        background: earned
                                            ? `${b.col}15` : 'transparent',
                                        fontSize: 11, fontWeight: 600,
                                        color: earned ? b.col : '#3a5070',
                                        fontFamily: 'Syne,sans-serif',
                                        opacity: earned ? 1 : .5,
                                        animation: earned
                                            ? 'badgePop .4s ease-out' : 'none',
                                        boxShadow: earned
                                            ? `0 0 10px ${b.col}25` : 'none'
                                    }}>
                                        <span>{b.icon}</span>
                                        <span>{b.name}</span>
                                        {earned && (
                                            <span style={{ fontSize: 10 }}>✓</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <style>{`
            @keyframes badgePop {
              0%   { transform:scale(.5) rotate(-10deg); opacity:0; }
              60%  { transform:scale(1.1) rotate(2deg); }
              100% { transform:scale(1)  rotate(0); opacity:1; }
            }
          `}</style>
                </div>

                {/* Right — Leaderboard + Stats */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>

                    {/* XP progress */}
                    <div style={CARD}>
                        <div style={{ padding: '14px 16px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '12px'
                            }}>
                                <div style={{
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    background: 'rgba(107,47,196,0.15)',
                                    border: '1px solid rgba(107,47,196,0.3)',
                                    fontSize: 12, fontWeight: 700,
                                    color: '#b48af0',
                                    fontFamily: 'JetBrains Mono,monospace'
                                }}>
                                    Level {level}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '4px'
                                    }}>
                                        <span style={{
                                            fontSize: 10, color: '#5a7494',
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            XP progress
                                        </span>
                                        <span style={{
                                            fontSize: 10, color: '#9aaec8',
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            {xp % 500} / 500
                                        </span>
                                    </div>
                                    <div style={{
                                        height: '6px',
                                        background: 'rgba(255,255,255,0.06)',
                                        borderRadius: '3px', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${xpPct}%`,
                                            background: 'linear-gradient(90deg,#e8294a,#6b2fc4)',
                                            borderRadius: '3px',
                                            transition: 'width .5s ease',
                                            boxShadow: '0 0 8px rgba(232,41,74,0.4)'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* Stats row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3,1fr)',
                                gap: '8px'
                            }}>
                                {[
                                    { label: 'Total XP', val: xp, col: '#6b2fc4' },
                                    { label: 'Correct', val: `${correct}/${questions.length}`, col: '#2ebc6e' },
                                    { label: 'Level', val: level, col: '#e8b418' },
                                ].map((s, i) => (
                                    <div key={i} style={{
                                        textAlign: 'center',
                                        padding: '8px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        border: '1px solid #1e2d4a'
                                    }}>
                                        <div style={{
                                            fontSize: 18, fontWeight: 800,
                                            color: s.col,
                                            fontFamily: 'JetBrains Mono,monospace'
                                        }}>
                                            {s.val}
                                        </div>
                                        <div style={{
                                            fontSize: 9, color: '#3a5070',
                                            textTransform: 'uppercase',
                                            letterSpacing: '.06em',
                                            fontFamily: 'JetBrains Mono,monospace',
                                            marginTop: '2px'
                                        }}>
                                            {s.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Submit score */}
                    <div style={CARD}>
                        <div style={{ padding: '12px 16px' }}>
                            {showName ? (
                                <div>
                                    <div style={{
                                        fontSize: 11, color: '#9aaec8',
                                        marginBottom: '8px',
                                        fontFamily: 'Syne,sans-serif'
                                    }}>
                                        Enter your name for the leaderboard:
                                    </div>
                                    <div style={{
                                        display: 'flex', gap: '8px'
                                    }}>
                                        <input
                                            placeholder="Your name..."
                                            value={nameInput}
                                            onChange={e => setNameInput(e.target.value)}
                                            onKeyDown={e =>
                                                e.key === 'Enter' && handleSaveName()}
                                            style={{
                                                flex: 1, padding: '7px 12px',
                                                borderRadius: '7px',
                                                fontSize: '11px',
                                                fontFamily: 'JetBrains Mono,monospace',
                                                background: '#070d1a',
                                                border: '1px solid #2a3d5e',
                                                color: '#9aaec8', outline: 'none'
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSaveName}
                                            style={{
                                                padding: '7px 14px',
                                                borderRadius: '7px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                fontFamily: 'Syne,sans-serif',
                                                border: 'none',
                                                background: 'linear-gradient(135deg,#e8294a,#6b2fc4)',
                                                color: 'white'
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    {userName && (
                                        <span style={{
                                            fontSize: 11, color: '#5a7494',
                                            fontFamily: 'Syne,sans-serif'
                                        }}>
                                            Playing as <span style={{
                                                color: '#9aaec8', fontWeight: 700
                                            }}>{userName}</span>
                                        </span>
                                    )}
                                    <button
                                        onClick={submitScore}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            fontFamily: 'Syne,sans-serif',
                                            border: 'none',
                                            background: 'linear-gradient(135deg,#e8294a,#6b2fc4)',
                                            color: 'white',
                                            boxShadow: '0 0 14px rgba(232,41,74,0.25)',
                                            marginLeft: 'auto'
                                        }}
                                    >
                                        Submit score →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div style={CARD}>
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #1e2d4a',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={LBL}>Global leaderboard</span>
                            <button
                                onClick={loadLeaderboard}
                                style={{
                                    fontSize: 9, color: '#3a5070',
                                    background: 'none', border: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'JetBrains Mono,monospace'
                                }}
                            >
                                ↺ refresh
                            </button>
                        </div>

                        {leaderboard.length === 0 ? (
                            <div style={{
                                padding: '20px 16px',
                                textAlign: 'center',
                                fontSize: 11, color: '#3a5070',
                                fontFamily: 'Syne,sans-serif'
                            }}>
                                No scores yet — be the first!
                                <br />
                                <span style={{
                                    fontSize: 10, color: '#3a5070', marginTop: '4px',
                                    display: 'block'
                                }}>
                                    Submit your score above to appear here
                                </span>
                            </div>
                        ) : (
                            <div>
                                {leaderboard.slice(0, 8).map((entry, i) => {
                                    const isYou = entry.name === userName
                                    const medals = ['🥇', '🥈', '🥉']
                                    return (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 14px',
                                            borderBottom: '1px solid rgba(30,45,74,0.4)',
                                            background: isYou
                                                ? 'rgba(107,47,196,0.08)' : 'transparent',
                                            borderLeft: isYou
                                                ? '3px solid #6b2fc4'
                                                : '3px solid transparent'
                                        }}>
                                            <span style={{
                                                fontSize: i < 3 ? '14px' : '10px',
                                                width: '18px', textAlign: 'center',
                                                fontFamily: 'JetBrains Mono,monospace',
                                                color: '#5a7494'
                                            }}>
                                                {i < 3 ? medals[i] : i + 1}
                                            </span>

                                            {/* Avatar */}
                                            <div style={{
                                                width: 26, height: 26,
                                                borderRadius: '50%',
                                                background: isYou
                                                    ? 'linear-gradient(135deg,#e8294a,#6b2fc4)'
                                                    : '#162240',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 9, fontWeight: 700,
                                                color: isYou ? 'white' : '#5a7494',
                                                flexShrink: 0,
                                                border: `1px solid ${isYou ? '#6b2fc4' : '#1e2d4a'}`
                                            }}>
                                                {entry.name?.slice(0, 2).toUpperCase()}
                                            </div>

                                            <span style={{
                                                flex: 1, fontSize: 12,
                                                fontWeight: isYou ? 700 : 500,
                                                color: isYou ? '#e8eef8' : '#9aaec8',
                                                fontFamily: 'Syne,sans-serif'
                                            }}>
                                                {entry.name}
                                                {isYou && (
                                                    <span style={{
                                                        marginLeft: '5px', fontSize: 9,
                                                        color: '#6b2fc4',
                                                        fontFamily: 'JetBrains Mono,monospace'
                                                    }}>
                                                        (you)
                                                    </span>
                                                )}
                                            </span>

                                            <span style={{
                                                fontSize: 12, fontWeight: 700,
                                                color: '#6b2fc4',
                                                fontFamily: 'JetBrains Mono,monospace'
                                            }}>
                                                {entry.xp?.toLocaleString()} XP
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}