import QuizPanel from '../components/quiz/QuizPanel'

export default function QuizPage() {
    return (
        <div style={{ padding: '18px 24px', animation: 'fadeUp .35s ease both' }}>
            <div style={{
                display: 'inline-block',
                background: 'rgba(212,32,144,0.12)',
                border: '1px solid rgba(212,32,144,0.3)',
                color: '#d42090',
                fontSize: '9px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.1em',
                marginBottom: '8px'
            }}>
                06 · QUIZ
            </div>
            <h1 style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#e8eef8',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                fontFamily: 'Syne, sans-serif'
            }}>
                Gamified Quiz — Earn XP & Badges
            </h1>
            <p style={{
                fontSize: '12px',
                color: '#5a7494',
                marginBottom: '16px',
                lineHeight: 1.6
            }}>
                Context-aware questions generated from your simulation.
                Correct answers earn XP, unlock badges and climb the leaderboard.
            </p>
            <QuizPanel />
        </div>
    )
}