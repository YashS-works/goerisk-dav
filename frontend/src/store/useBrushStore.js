import { create } from 'zustand'

const useBrushStore = create((set, get) => ({
    hoveredCountry: null,
    selectedCountry: null,
    activeTimestep: 0,
    activeDomain: 'all',
    highlightedPath: [],

    setHoveredCountry: (code) => {
        set({ hoveredCountry: code })
        // Emit custom event for D3 components
        window.dispatchEvent(
            new CustomEvent('georisk:hover', { detail: { code } })
        )
    },

    setSelectedCountry: (code) => {
        set({ selectedCountry: code })
        window.dispatchEvent(
            new CustomEvent('georisk:select', { detail: { code } })
        )
    },

    setActiveTimestep: (step) => set({ activeTimestep: step }),
    setActiveDomain: (dom) => set({ activeDomain: dom }),
    setHighlightedPath: (path) => set({ highlightedPath: path }),

    clearHover: () => {
        set({ hoveredCountry: null })
        window.dispatchEvent(
            new CustomEvent('georisk:hover', { detail: { code: null } })
        )
    },

    clearAll: () => set({
        hoveredCountry: null,
        selectedCountry: null,
        activeTimestep: 0,
        activeDomain: 'all',
        highlightedPath: []
    })
}))

export default useBrushStore