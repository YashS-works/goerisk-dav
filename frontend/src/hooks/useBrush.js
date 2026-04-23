import { useCallback, useEffect } from 'react'
import useBrushStore from '../store/useBrushStore'

export function useBrush() {
    const {
        hoveredCountry,
        selectedCountry,
        activeTimestep,
        activeDomain,
        setHoveredCountry,
        setSelectedCountry,
        setActiveTimestep,
        setActiveDomain,
        clearHover
    } = useBrushStore()

    const onHover = useCallback(
        (code) => setHoveredCountry(code), []
    )
    const onSelect = useCallback(
        (code) => setSelectedCountry(code), []
    )

    return {
        hovered: hoveredCountry,
        selected: selectedCountry,
        timestep: activeTimestep,
        domain: activeDomain,
        onHover,
        onSelect,
        clearHover,
        setTimestep: setActiveTimestep,
        setDomain: setActiveDomain
    }
}

// Use this ONLY inside React component function bodies
export function useGeoRiskEvent(eventName, callback) {
    useEffect(() => {
        window.addEventListener(eventName, callback)
        return () => window.removeEventListener(eventName, callback)
    }, [eventName, callback])
}