// Detecta el cambio de día: justo a la medianoche, y además con un chequeo periódico
// que cubre la vuelta de una suspensión o un cambio de hora del sistema.

import { msUntilMidnight } from '../shared/dates'

const CHECK_INTERVAL_MS = 15_000
// Margen para no despertar unos milisegundos antes de las 00:00.
const MIDNIGHT_MARGIN_MS = 50

export interface DayWatcher {
  check: () => void
  stop: () => void
}

export function watchDayChange(getToday: () => string, onChange: (today: string) => void): DayWatcher {
  let last = getToday()
  let midnightTimer: ReturnType<typeof setTimeout>

  const check = (): void => {
    const today = getToday()
    if (today !== last) {
      last = today
      onChange(today)
    }
  }

  const scheduleMidnight = (): void => {
    midnightTimer = setTimeout(() => {
      check()
      scheduleMidnight()
    }, msUntilMidnight(new Date()) + MIDNIGHT_MARGIN_MS)
  }

  const interval = setInterval(check, CHECK_INTERVAL_MS)
  scheduleMidnight()

  return {
    check,
    stop: () => {
      clearInterval(interval)
      clearTimeout(midnightTimer)
    }
  }
}
