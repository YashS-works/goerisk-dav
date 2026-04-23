import client from './client'

export const analyticsAPI = {
    // Get network graph data
    getNetwork: (shockType = 'war', intensity = 0.7) =>
        client.get('/analytics/network', {
            params: { shock_type: shockType, intensity }
        }),

    // Get bottleneck countries
    getBottlenecks: (shockType = 'war', intensity = 0.7) =>
        client.get('/analytics/bottlenecks', {
            params: { shock_type: shockType, intensity }
        }),

    // Get vulnerability clusters
    getClusters: (shockType = 'war', intensity = 0.7) =>
        client.get('/analytics/clusters', {
            params: { shock_type: shockType, intensity }
        }),

    // Get cascade path between two countries
    getPath: (origin, target, shockType = 'war', intensity = 0.7) =>
        client.get(`/analytics/path/${origin}/${target}`, {
            params: { shock_type: shockType, intensity }
        }),

    // Get SI trends
    getTrends: (shockType = 'war', intensity = 0.7) =>
        client.get('/analytics/trends', {
            params: { shock_type: shockType, intensity }
        }),

    // Get full analytics summary
    getSummary: (shockType = 'war', intensity = 0.7) =>
        client.get('/analytics/summary', {
            params: { shock_type: shockType, intensity }
        })
}