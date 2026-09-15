import { useEffect, useRef, useState } from 'react'
import { msUntilMidnight } from '@shared/dates'

// Ejecuta callback cada vez que el proceso principal detecta que cambió el día.
export function useDayChange(callback: (today: string) => void): void {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  useEffect(() => window.api.onDayChanged((today) => latest.current(today)), [])
}

// Minutos (redondeados hacia arriba) que faltan para la medianoche; se actualiza solo.
export function useMinutesToMidnight(): number {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(timer)
  }, [])
  return Math.ceil(msUntilMidnight(now) / 60_000)
}
