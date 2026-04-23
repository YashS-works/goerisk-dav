import { create } from 'zustand'

const useSimStore = create((set, get) => ({
    // Country selection
    selA: null,
    selB: null,

    // Shock parameters
    shockType: 'war',
    intensity: 0.7,
    domain: 'energy',

    // Simulation results
    isRunning: false,
    hasRun: false,
    result: null,
    cascadeStep: 0,
    error: null,

    // Actions
    setSelA: (country) => set({ selA: country }),
    setSelB: (country) => set({ selB: country }),

    setShockType: (type) => set({ shockType: type }),
    setIntensity: (val) => set({ intensity: val }),
    setDomain: (dom) => set({ domain: dom }),

    setCascadeStep: (step) => set({ cascadeStep: step }),

    setRunning: (val) => set({ isRunning: val }),

    setResult: (result) => set({
        result,
        hasRun: true,
        isRunning: false,
        cascadeStep: 0,
        error: null
    }),

    setError: (error) => set({
        error,
        isRunning: false
    }),

    reset: () => set({
        selA: null,
        selB: null,
        isRunning: false,
        hasRun: false,
        result: null,
        cascadeStep: 0,
        error: null
    }),

    // Check if ready to fire
    canFire: () => {
        const { selA, selB, isRunning } = get()
        return selA && selB && !isRunning
    }
}))

export default useSimStore