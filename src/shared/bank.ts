// Bancos de ejercicios: ejercicios cortos escritos y revisados de antemano para cada subtema, así la
// práctica abre al instante y se corrige sin Claude. Viven con el temario, en
// content/<idioma>/<nivel>/<tópico>/banco.json, y la app suma los que genera en segundo plano.

import { z } from 'zod'
import { CEFR_LEVELS, type CefrLevel, type Subtopic } from './curriculum'
import { generatedExerciseSchema, type ExerciseType } from './exercises'

// Los formatos que van en el banco: los cortos, que se pueden cambiar por otro igual.
export const BANK_TYPES = [
  'multiple_choice',
  'fill_blank',
  'word_order',
  'error_correction',
  'translation',
  'reading',
  'transformation',
  'dictation',
  'minimal_pair',
  'shadowing',
  'listening',
  'reorder_text'
] as const satisfies readonly ExerciseType[]

export type BankType = (typeof BANK_TYPES)[number]

export const isBankType = (type: ExerciseType): type is BankType => (BANK_TYPES as readonly ExerciseType[]).includes(type)

// Cuántos de cada formato se escriben por subtema.
export const BANK_TARGET: Record<BankType, number> = {
  multiple_choice: 6,
  fill_blank: 6,
  word_order: 5,
  error_correction: 5,
  translation: 6,
  reading: 2,
  transformation: 5,
  dictation: 4,
  minimal_pair: 3,
  // Ya no se usan (no hay ejercicios para decir en voz alta).
  shadowing: 0,
  listening: 2,
  reorder_text: 2
}

// Los formatos que no van en todos los niveles (igual que en la práctica): transformar y ordenar un texto
// desde A2, pares mínimos hasta B1. Los de lectura, solo en los subtemas con días de lectura.
const LEVELS: Partial<Record<BankType, [CefrLevel, CefrLevel]>> = {
  transformation: ['A2', 'C2'],
  reorder_text: ['A2', 'C2'],
  minimal_pair: ['A1', 'B1']
}
const READING_TYPES: BankType[] = ['reading', 'reorder_text']

// Lo que lleva el banco de un subtema de cierto nivel.
export function bankWants(subtopic: Pick<Subtopic, 'focus'>, level: CefrLevel): Partial<Record<BankType, number>> {
  const rank = CEFR_LEVELS.indexOf(level)
  const fits = (type: BankType): boolean => {
    const range = LEVELS[type]
    if (range && (rank < CEFR_LEVELS.indexOf(range[0]) || rank > CEFR_LEVELS.indexOf(range[1]))) return false
    return !READING_TYPES.includes(type) || subtopic.focus.includes('reading')
  }
  return Object.fromEntries(BANK_TYPES.filter((type) => BANK_TARGET[type] > 0 && fits(type)).map((type) => [type, BANK_TARGET[type]]))
}

// Los pedidos en que se escribe un banco, para que ninguno quede demasiado largo: los de gramática,
// los de escuchar y transformar, y los de texto largo.
const BANK_GROUPS: BankType[][] = [
  ['multiple_choice', 'fill_blank', 'word_order', 'error_correction', 'translation'],
  ['transformation', 'dictation', 'minimal_pair', 'shadowing'],
  ['reading', 'listening', 'reorder_text']
]

export function splitBankCounts(counts: Partial<Record<BankType, number>>): Partial<Record<BankType, number>>[] {
  return BANK_GROUPS.map((group) => Object.fromEntries(group.filter((type) => counts[type]).map((type) => [type, counts[type]!]))).filter(
    (part) => Object.keys(part).length > 0
  )
}

// Por debajo de esta cantidad sin usar, la app genera más en segundo plano.
export const BANK_LOW_WATER = 8

export const bankFileSchema = z
  .object({
    // Una lista de ejercicios por subtema (por su id).
    subtopics: z.record(z.string(), z.array(z.unknown()))
  })
  .strict()

export type BankFile = z.infer<typeof bankFileSchema>

export { generatedExerciseSchema }
