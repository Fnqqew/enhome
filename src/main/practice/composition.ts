// Qué ejercicios se piden para cada práctica y cuáles entran en la sesión.

import type { Skill } from '../../shared/curriculum'
import { EXERCISE_TYPES, LONG_TYPES, type ExerciseType } from '../../shared/exercises'

export const SESSION_SIZE = 8
// Siempre se generan alternativas para poder cambiar de ejercicio.
export const MIN_POOL_SIZE = SESSION_SIZE + 2

// Promedio de calificación del alumno por tipo (1 a 5).
export type TypePreferences = Partial<Record<ExerciseType, number>>

// Lo que eligió el alumno en Ajustes: cuántos ejercicios tiene la práctica y qué formatos no quiere.
export interface SessionOptions {
  size: number
  excluded: ExerciseType[]
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = { size: SESSION_SIZE, excluded: [] }

const NEUTRAL_RATING = 3
const LIKED_RATING = 4
const DISLIKED_RATING = 2

// Los cortos, que se pueden cambiar por otro sin desarmar la práctica.
const FLEXIBLE_TYPES: ExerciseType[] = [
  'multiple_choice',
  'fill_blank',
  'word_order',
  'error_correction',
  'translation',
  'transformation',
  'dictation',
  'minimal_pair'
]
// Siempre entra uno de estos: es la parte en la que el alumno se mete en una situación real.
const IMMERSIVE_TYPES: ExerciseType[] = ['dialogue', 'roleplay']
// Escuchar y hablar todos los días (en las prácticas de 8 o más ejercicios).
const LISTENING_TYPES: ExerciseType[] = ['dictation', 'listening', 'minimal_pair']
const SPEAKING_TYPES: ExerciseType[] = ['shadowing']
// Desde cuántos ejercicios la práctica suma una escucha y algo para decir en voz alta.
const FULL_SESSION = 8

// El orden de la sesión: de lo más guiado a lo más abierto, con la escucha y el habla en el medio.
const SESSION_ORDER: ExerciseType[] = [
  'multiple_choice',
  'fill_blank',
  'word_order',
  'error_correction',
  'transformation',
  'minimal_pair',
  'dictation',
  'translation',
  'reorder_text',
  'reading',
  'listening',
  'shadowing',
  'translation_set',
  'dialogue',
  'roleplay',
  'writing'
]

const rating = (preferences: TypePreferences, type: ExerciseType): number => preferences[type] ?? NEUTRAL_RATING

// Lectura, escritura, la tanda de traducción y la parte conversacional son obligatorias aunque no gusten.
function isRequired(type: ExerciseType, focus: Skill[]): boolean {
  if (type === 'translation_set' || IMMERSIVE_TYPES.includes(type)) return true
  return (type === 'reading' && focus.includes('reading')) || (type === 'writing' && focus.includes('writing'))
}

// Recordar fija más que reconocer: la opción múltiple va quedando para A1 y, con el nivel, pesan más
// los formatos en los que hay que escribir la respuesta.
const RECALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function planPool(
  focus: Skill[],
  preferences: TypePreferences = {},
  options: SessionOptions = DEFAULT_SESSION_OPTIONS,
  level = 'A1'
): Partial<Record<ExerciseType, number>> {
  const grammarDay = focus.includes('grammar')
  const writingDay = focus.includes('writing')
  const rank = Math.max(0, RECALL_LEVELS.indexOf(level))
  const full = options.size >= FULL_SESSION
  const plan: Record<ExerciseType, number> = {
    multiple_choice: rank === 0 ? (grammarDay ? 2 : 1) : 1,
    fill_blank: grammarDay ? 2 : 1,
    word_order: grammarDay && rank < 3 ? 2 : 1,
    error_correction: grammarDay ? 2 : 1,
    translation: writingDay ? 2 : 1,
    translation_set: 1,
    dialogue: 1,
    roleplay: 1,
    reading: focus.includes('reading') ? 2 : 0,
    writing: writingDay ? 2 : 0,
    dictation: full ? 1 : 0,
    listening: full ? 1 : 0,
    minimal_pair: full && rank < 3 ? 1 : 0,
    shadowing: full ? 1 : 0,
    transformation: rank >= 1 ? (grammarDay ? 2 : 1) : 0,
    reorder_text: rank >= 1 && focus.includes('reading') ? 1 : 0
  }

  for (const type of EXERCISE_TYPES) {
    if (plan[type] === 0 || isRequired(type, focus)) continue
    if (rating(preferences, type) >= LIKED_RATING) plan[type]++
    else if (rating(preferences, type) <= DISLIKED_RATING) plan[type]--
  }
  for (const type of options.excluded) plan[type] = 0

  // Si el alumno sacó todos los cortos, se ignora la exclusión de esos: sin ellos no hay práctica.
  const allowedFlexible = FLEXIBLE_TYPES.filter((type) => !options.excluded.includes(type))
  const flexible = allowedFlexible.length > 0 ? allowedFlexible : FLEXIBLE_TYPES
  const flexibleByRating = [...flexible].sort((a, b) => rating(preferences, b) - rating(preferences, a))
  let total = Object.values(plan).reduce((sum, n) => sum + n, 0)
  for (let i = 0; total < options.size + 2; i++, total++) plan[flexibleByRating[i % flexibleByRating.length]]++

  return Object.fromEntries(Object.entries(plan).filter(([, n]) => n > 0))
}

export interface PoolItem {
  id: number
  type: ExerciseType
}

export const isLongType = (type: ExerciseType): boolean => (LONG_TYPES as readonly ExerciseType[]).includes(type)

// Lugares de la sesión que ocupan los ejercicios largos: la tanda de traducción, la parte
// conversacional y, los días de escritura, el texto.
export function longSlots(focus: Skill[], excluded: ExerciseType[] = []): number {
  const allowed = (type: ExerciseType): boolean => !excluded.includes(type)
  const immersive = IMMERSIVE_TYPES.some(allowed) ? 1 : 0
  return (allowed('translation_set') ? 1 : 0) + immersive + (focus.includes('writing') && allowed('writing') ? 1 : 0)
}

const orderOf = (type: ExerciseType): number => {
  const index = SESSION_ORDER.indexOf(type)
  return index === -1 ? SESSION_ORDER.length + EXERCISE_TYPES.indexOf(type) : index
}
const byTypeOrder = (a: PoolItem, b: PoolItem): number => orderOf(a.type) - orderOf(b.type)

// Primera parte de una sesión que arranca antes de que lleguen los largos: solo ejercicios cortos,
// dejando libres los lugares de los largos.
export function composeShort(
  pool: PoolItem[],
  focus: Skill[],
  preferences: TypePreferences = {},
  options: SessionOptions = DEFAULT_SESSION_OPTIONS,
  random: () => number = Math.random
): number[] {
  const short = pool.filter((item) => !isLongType(item.type) && !options.excluded.includes(item.type))
  return composeSession(short, focus, preferences, random, options.size - longSlots(focus, options.excluded))
}

// Segunda parte: los largos obligatorios, cuando llegan.
export function composeLong(pool: PoolItem[], focus: Skill[], random: () => number = Math.random): number[] {
  const available = pool.filter((item) => isLongType(item.type))
  const chosen: PoolItem[] = []
  const take = (...types: ExerciseType[]): void => {
    for (const type of types) {
      const index = available.findIndex((item) => item.type === type)
      if (index >= 0) {
        chosen.push(...available.splice(index, 1))
        return
      }
    }
  }
  if (focus.includes('writing')) take('writing')
  take('translation_set')
  take(...(random() < 0.5 ? IMMERSIVE_TYPES : [...IMMERSIVE_TYPES].reverse()))
  return chosen.sort(byTypeOrder).map((item) => item.id)
}

// Elige los ejercicios de la sesión: primero los obligatorios (lectura, escritura, la tanda de
// traducción y una situación para conversar), después variedad priorizando los mejor calificados,
// y los ordena de lo más guiado a lo más abierto.
export function composeSession(
  pool: PoolItem[],
  focus: Skill[],
  preferences: TypePreferences = {},
  random: () => number = Math.random,
  size = SESSION_SIZE
): number[] {
  const available = [...pool]
  const chosen: PoolItem[] = []
  // Toma el primero disponible respetando el orden de preferencia de los tipos pedidos.
  const take = (...types: ExerciseType[]): void => {
    for (const type of types) {
      const index = available.findIndex((item) => item.type === type)
      if (index >= 0) {
        chosen.push(...available.splice(index, 1))
        return
      }
    }
  }

  if (focus.includes('reading')) take('reading')
  if (focus.includes('writing')) take('writing')
  take('translation_set')
  // La conversación y la situación se alternan para que la práctica no se vuelva rutina.
  take(...(random() < 0.5 ? IMMERSIVE_TYPES : [...IMMERSIVE_TYPES].reverse()))
  // Escuchar y hablar todos los días.
  if (size >= FULL_SESSION) {
    take(...[...LISTENING_TYPES].sort(() => random() - 0.5))
    take(...SPEAKING_TYPES)
  }

  while (chosen.length < size && available.length > 0) {
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

  return chosen.sort(byTypeOrder).map((item) => item.id)
}
