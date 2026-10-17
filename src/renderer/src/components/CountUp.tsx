import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 700

const reducedMotion = (): boolean =>
  document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Un número que sube (o baja) contando hasta su valor, en vez de saltar. Con «Animaciones: reducidas»
// muestra el valor directamente.
export default function CountUp({ value, decimals = 0, from = 0 }: { value: number; decimals?: number; from?: number }): React.JSX.Element {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : from))
  const current = useRef(shown)

  useEffect(() => {
    if (reducedMotion()) {
      current.current = value
      setShown(value)
      return
    }
    const start = current.current
    const began = performance.now()
    let frame = 0
    const step = (now: number): void => {
      const t = Math.min(1, (now - began) / DURATION_MS)
      // Arranca rápido y frena al llegar.
      const eased = 1 - Math.pow(1 - t, 3)
      const next = start + (value - start) * eased
      current.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{shown.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}
