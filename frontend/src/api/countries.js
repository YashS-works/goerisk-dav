import client from './client'

export const countriesAPI = {
    // Get all countries with metadata
    getAll: () =>
        client.get('/data/all'),

    // Get SI scores for all countries
    getAllSI: (shockType = 'war', intensity = 0.7) =>
        client.get('/data/si/all', {
            params: { shock_type: shockType, intensity }
        }),

    // Get single country SI profile
    getCountrySI: (code, shockType = 'war', intensity = 0.7) =>
        client.get(`/data/si/${code}`, {
            params: { shock_type: shockType, intensity }
        }),

    // Get conflict events
    getConflicts: () =>
        client.get('/data/conflicts')
}