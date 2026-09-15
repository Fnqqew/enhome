// Qué ejercicios se piden para cada práctica y cuáles entran en la sesión.

import type { Skill } from '../../shared/curriculum'
import { EXERCISE_TYPES, type ExerciseType } from '../../shared/exercises'

export const SESSION_SIZE = 6
// Siempre se generan alternativas para poder cambiar de ejercicio.
export const MIN_POOL_SIZE = SESSION_SIZE + 2

// Promedio de calificación del alumno por tipo (1 a 5).
export type TypePreferences = Partial<Record<ExerciseType, number>>

const NEUTRAL_RATING = 3
const LIKED_RATING = 4
const DISLIKED_RATING = 2
const FLEXIBLE_TYPES: ExerciseType[] = ['multiple_choice', 'fill_blank', 'word_order', 'error_correction', 'translation']

const rating = (preferences: TypePreferences, type: ExerciseType): number => preferences[type] ?? NEUTRAL_RATING

// Lectura y escritura son obligatorias en los días que las trabajan, aunque no gusten.
function isRequired(type: ExerciseType, focus: Skill[]): boolean {
  return (type === 'reading' && focus.includes('reading')) || (type === 'writing' && focus.includes('writing'))
}

export function planPool(focus: Skill[], preferences: TypePreferences = {}): Partial<Record<ExerciseType, number>> {
  const grammarDay = focus.includes('grammar')
  const plan: Record<ExerciseType, number> = {
    multiple_choice: grammarDay ? 2 : 1,
    fill_blank: grammarDay ? 2 : 1,
    word_order: grammarDay ? 2 : 1,
    error_correction: grammarDay ? 2 : 1,
    translation: focus.includes('writing') ? 2 : 1,
    reading: focus.includes('reading') ? 2 : 0,
    writing: focus.includes('writing') ? 2 : 0
  }

  for (const type of EXERCISE_TYPES) {
    if (plan[type] === 0) continue
    if (rating(preferences, type) >= LIKED_RATING) plan[type]++
    else if (rating(preferences, type) <= DISLIKED_RATING && !isRequired(type, focus)) plan[type]--
  }

  const flexibleByRating = [...FLEXIBLE_TYPES].sort((a, b) => rating(preferences, b) - rating(preferences, a))
  let total = Object.values(plan).reduce((sum, n) => sum + n, 0)
  for (let i = 0; total < MIN_POOL_SIZE; i++, total++) plan[flexibleByRating[i % flexibleByRating.length]]++

  return Object.fromEntries(Object.entries(plan).filter(([, n]) => n > 0))
}

export interface PoolItem {
  id: number
  type: ExerciseType
}

// Elige los ejercicios de la sesión: los obligatorios, después variedad de tipos priorizando
// los mejor calificados, y los ordena de lo más guiado a lo más abierto.
export function composeSession(
  pool: PoolItem[],
  focus: Skill[],
  preferences: TypePreferences = {},
  random: () => number = Math.random
): number[] {
  const available = [...pool]
  const chosen: PoolItem[] = []
  const take = (type: ExerciseType): void => {
    const index = available.findIndex((item) => item.type === type)
    if (index >= 0) chosen.push(...available.splice(index, 1))
  }

  if (focus.includes('reading')) take('reading')
  if (focus.includes('writing')) take('writing')

  while (chosen.length < SESSION_SIZE && available.length > 0) {
    const flexible = available.filter((item) => FLEXIBLE_TYPES.includes(item.type))
    const candidates = flexible.length > 0 ? flexible : available
    const used = new Set(chosen.map((item) => item.type))
    const fresh = candidates.filter((item) => !used.has(item.type))
    const options = fresh.length > 0 ? fresh : candidates

    let best = options[0]
    let bestScore = -Infinity
    for (const item of options) {
      const score = rating(preferences, item.type) + random() * 1.5
      if (score > bestScore) {
        best = item
        bestScore = score
      }
    }
    chosen.push(...available.splice(available.indexOf(best), 1))
  }

  return chosen.sort((a, b) => EXERCISE_TYPES.indexOf(a.type) - EXERCISE_TYPES.indexOf(b.type)).map((item) => item.id)
}
