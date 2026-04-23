import { useEffect, useRef, useCallback, useState } from 'react'

export function useAnimFrame(callback, active = true) {
    const rafRef = useRef(null)
    const cbRef = useRef(callback)

    useEffect(() => { cbRef.current = callback }, [callback])

    const start = useCallback(() => {
        const loop = (time) => {
            cbRef.current(time)
            rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
    }, [])

    const stop = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
    }, [])

    useEffect(() => {
        if (active) start()
        else stop()
        return stop
    }, [active])

    return { start, stop }
}

export function useCountUp(target, duration = 1000) {
    const [current, setCurrent] = useState(0)
    const startRef = useRef(null)
    const startVal = useRef(0)

    useEffect(() => {
        if (target === 0) { setCurrent(0); return }
        startVal.current = current
        startRef.current = performance.now()

        const update = (now) => {
            const elapsed = now - startRef.current
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            const val = startVal.current +
                (target - startVal.current) * eased
            setCurrent(Math.round(val))
            if (progress < 1) requestAnimationFrame(update)
        }

        requestAnimationFrame(update)
    }, [target])

    return current
}