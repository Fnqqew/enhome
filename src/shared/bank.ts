// Bancos de ejercicios: ejercicios cortos escritos y revisados de antemano para cada subtema, así la
// práctica abre al instante y se corrige sin Claude. Viven con el temario, en
// content/<idioma>/<nivel>/<tópico>/banco.json, y la app suma los que genera en segundo plano.

import { z } from 'zod'
import { generatedExerciseSchema, type ExerciseType } from './exercises'

// Los formatos que van en el banco: se corrigen solos y se pueden cambiar por otro igual.
export const BANK_TYPES = [
  'multiple_choice',
  'fill_blank',
  'word_order',
  'error_correction',
  'translation',
  'reading'
] as const satisfies readonly ExerciseType[]

export type BankType = (typeof BANK_TYPES)[number]

export const isBankType = (type: ExerciseType): type is BankType => (BANK_TYPES as readonly ExerciseType[]).includes(type)

// Cuántos de cada formato se escriben por subtema (la lectura, solo los días de lectura).
export const BANK_TARGET: Record<BankType, number> = {
  multiple_choice: 6,
  fill_blank: 6,
  word_order: 5,
  error_correction: 5,
  translation: 6,
  reading: 2
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
