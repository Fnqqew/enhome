// Cálculo puro de la racha: días hábiles seguidos con práctica.
// El fin de semana no cuenta ni corta; el día de hoy no corta hasta que termine.

import { addDays } from '../../shared/dates'

export interface StreakWeek {
  id: number
  weekStart: string
  startsOn: string
}

export interface StreakMilestone {
  // Primer día de la racha (identifica la racha para no premiar dos veces el mismo hito).
  chainStart: string
  length: number
}

export interface StreakResult {
  current: number
  best: number
  // Primer día faltado todavía sin resolver (protector o corte); null si no hay.
  pendingMiss: string | null
  milestones: StreakMilestone[]
  expected: Set<string>
}

export function expectedDays(weeks: StreakWeek[], today: string): string[] {
  const days = new Set<string>()
  for (const week of weeks) {
    for (let i = 0; i < 5; i++) {
      const date = addDays(week.weekStart, i)
      if (date >= week.startsOn && date <= today) days.add(date)
    }
  }
  return [...days].sort()
}

export function computeStreak({
  weeks,
  practiced,
  events,
  today
}: {
  weeks: StreakWeek[]
  practiced: Set<string>
  events: Map<string, 'protected' | 'broken'>
  today: string
}): StreakResult {
  const expected = expectedDays(weeks, today)
  const milestones: StreakMilestone[] = []
  let current = 0
  let best = 0
  let chainStart: string | null = null

  for (const date of expected) {
    if (practiced.has(date)) {
      if (current === 0) chainStart = date
      current++
      best = Math.max(best, current)
      milestones.push({ chainStart: chainStart!, length: current })
      continue
    }
    if (date === today) continue
    const event = events.get(date)
    if (event === 'protected') continue
    if (event === 'broken') {
      current = 0
      chainStart = null
      continue
    }
    return { current, best, pendingMiss: date, milestones, expected: new Set(expected) }
  }
  return { current, best, pendingMiss: null, milestones, expected: new Set(expected) }
}

// Semanas completas (desde el lunes) con práctica los 5 días hábiles, ya terminadas o con el viernes hecho.
export function perfectWeeks(weeks: StreakWeek[], practiced: Set<string>, today: string): number[] {
  return weeks
    .filter((week) => {
      const friday = addDays(week.weekStart, 4)
      if (week.startsOn !== week.weekStart || friday > today) return false
      return Array.from({ length: 5 }, (_, i) => addDays(week.weekStart, i)).every((date) => practiced.has(date))
    })
    .map((week) => week.id)
}
