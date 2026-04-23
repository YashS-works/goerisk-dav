import client from './client'

export const simulationAPI = {
    // Run full cascade simulation
    run: (countryA, countryB, shockType, intensity, domain) =>
        client.post('/simulate/run', {
            country_a: countryA,
            country_b: countryB,
            shock_type: shockType,
            intensity: intensity,
            domain: domain
        }),

    // Get data for specific timestep
    getTimestep: (countryCode, timestep, shockType, intensity) =>
        client.get(`/simulate/timestep/${countryCode}/${timestep}`, {
            params: { shock_type: shockType, intensity }
        }),

    // Get country profile on click
    getCountryProfile: (code, shockType, intensity) =>
        client.get(`/simulate/country/${code}`, {
            params: { shock_type: shockType, intensity }
        })
}