// Vocabulario núcleo: las palabras más frecuentes de cada idioma por nivel, en orden de frecuencia
// (content/<idioma>/vocabulario.json). Cada día se proponen las siguientes del nivel del alumno.

import { z } from 'zod'
import { CEFR_LEVELS } from './curriculum'

const text = z.string().trim().min(1)

export const coreWordSchema = z
  .object({
    term: text,
    es: text,
    level: z.enum(CEFR_LEVELS),
    // Tema (comida, trabajo, verbos frecuentes…), en español.
    theme: text,
    example: text,
    exampleEs: text
  })
  .strict()

export const coreVocabSchema = z.object({ words: z.array(coreWordSchema) }).strict()

export type CoreWord = z.infer<typeof coreWordSchema>

// Cuántas palabras nuevas se proponen por día.
export const CORE_WORDS_PER_DAY = 8

export interface CoreVocabToday {
  level: string
  // Las palabras de hoy (las siguientes del nivel que todavía no están en las tarjetas).
  words: CoreWord[]
  // Cuántas del nivel ya están en las tarjetas y cuántas tiene el nivel.
  learned: number
  total: number
}
