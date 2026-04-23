import { create } from 'zustand'

const useXPStore = create((set, get) => ({
    xp: parseInt(localStorage.getItem('georisk_xp') || '0'),
    level: 1,
    correct: 0,
    total: 0,
    badges: JSON.parse(localStorage.getItem('georisk_badges') || '[]'),

    // Quiz state
    questions: [],
    currentQ: 0,
    answers: {},
    quizComplete: false,

    addXP: (amount) => {
        const newXP = get().xp + amount
        const newLevel = Math.floor(newXP / 500) + 1
        localStorage.setItem('georisk_xp', newXP)
        set({ xp: newXP, level: newLevel })
        get().checkBadges()
    },

    answerQuestion: (qIndex, answerIndex, correct) => {
        const newAnswers = { ...get().answers, [qIndex]: answerIndex }
        const newCorrect = correct ? get().correct + 1 : get().correct
        const newTotal = get().total + 1

        set({
            answers: newAnswers,
            correct: newCorrect,
            total: newTotal,
        })

        if (correct) get().addXP(75)
    },

    setQuestions: (questions) => set({
        questions,
        currentQ: 0,
        answers: {},
        quizComplete: false
    }),

    nextQuestion: () => {
        const { currentQ, questions } = get()
        if (currentQ < questions.length - 1) {
            set({ currentQ: currentQ + 1 })
        } else {
            set({ quizComplete: true })
        }
    },

    prevQuestion: () => {
        const { currentQ } = get()
        if (currentQ > 0) set({ currentQ: currentQ - 1 })
    },

    checkBadges: () => {
        const { correct, badges } = get()
        const newBadges = [...badges]

        const badgeDefs = [
            { id: 'energy', name: 'Energy Analyst', threshold: 1 },
            { id: 'trade', name: 'Trade Explorer', threshold: 2 },
            { id: 'food', name: 'Food Defender', threshold: 3 },
            { id: 'shock', name: 'Shock Master', threshold: 5 },
        ]

        let changed = false
        badgeDefs.forEach(b => {
            if (correct >= b.threshold && !newBadges.find(x => x.id === b.id)) {
                newBadges.push({ id: b.id, name: b.name, earned: true })
                changed = true
            }
        })

        if (changed) {
            localStorage.setItem('georisk_badges', JSON.stringify(newBadges))
            set({ badges: newBadges })
        }
    },

    reset: () => {
        localStorage.removeItem('georisk_xp')
        localStorage.removeItem('georisk_badges')
        set({
            xp: 0, level: 1, correct: 0,
            total: 0, badges: [],
            questions: [], currentQ: 0,
            answers: {}, quizComplete: false
        })
    }
}))

export default useXPStore