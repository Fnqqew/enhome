// La guía de pronunciación de cada idioma (content/<idioma>/pronunciacion.json): los sonidos que no
// existen en español, pares mínimos, acentuación y entonación, todo para escuchar.

import { z } from 'zod'

const text = z.string().trim().min(1)
const pair = z.object({ target: text, es: text })

export const pronunciationSchema = z
  .object({
    intro: text,
    sounds: z
      .array(
        z.object({
          title: text,
          // Cómo se hace el sonido, comparado con el español.
          description: text,
          examples: z.array(pair).min(2).max(6),
          tip: text
        })
      )
      .min(4)
      .max(14),
    pairs: z
      .array(z.object({ a: text, b: text, meaningA: text, meaningB: text, note: text }))
      .min(4)
      .max(14),
    stress: text,
    intonation: text,
    // Diferencias entre las variantes (por ejemplo, Brasil y Portugal).
    variants: text
  })
  .strict()

export type PronunciationGuide = z.infer<typeof pronunciationSchema>
