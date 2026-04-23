import { create } from 'zustand'

const useDataStore = create((set) => ({
    // All countries metadata
    countries: [],
    countriesMap: {},

    // SI scores for all countries
    siScores: [],
    siMap: {},

    // Conflict events
    conflicts: [],

    // Analytics
    summary: null,
    bottlenecks: [],
    clusters: [],
    trends: null,
    network: null,

    // Loading states
    loading: {
        countries: false,
        si: false,
        analytics: false,
        network: false,
    },

    // Actions
    setCountries: (countries) => {
        const map = {}
        countries.forEach(c => { map[c.cca3] = c })
        set({ countries, countriesMap: map })
    },

    setSIScores: (siScores) => {
        const map = {}
        siScores.forEach(s => { map[s.country_code] = s })
        set({ siScores, siMap: map })
    },

    setConflicts: (conflicts) => set({ conflicts }),
    setSummary: (summary) => set({ summary }),
    setBottlenecks: (bottlenecks) => set({ bottlenecks }),
    setClusters: (clusters) => set({ clusters }),
    setTrends: (trends) => set({ trends }),
    setNetwork: (network) => set({ network }),

    setLoading: (key, val) =>
        set(state => ({
            loading: { ...state.loading, [key]: val }
        })),

    // Get country by code
    getCountry: (code) => {
        const { countriesMap } = useDataStore.getState()
        return countriesMap[code] || null
    },

    // Get SI for country
    getSI: (code) => {
        const { siMap } = useDataStore.getState()
        return siMap[code] || null
    }
}))

export default useDataStore