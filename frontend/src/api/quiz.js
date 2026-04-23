import client from './client'

export const quizAPI = {
    // Generate quiz from simulation
    generate: (simulationData) =>
        client.post('/quiz/generate', simulationData),

    // Generate AI insights
    generateInsights: (simulationData) =>
        client.post('/quiz/insights', simulationData),

    // Get leaderboard
    getLeaderboard: () =>
        client.get('/quiz/leaderboard'),

    // Update user score
    updateScore: (name, xp) =>
        client.post('/quiz/leaderboard/update', { name, xp })
}