// El curso de escritura de los idiomas con otro alfabeto (content/<idioma>/escritura.json): los
// caracteres en grupos, con su romanización y una palabra de ejemplo, y cómo escribir con el teclado.

import { z } from 'zod'

const text = z.string().trim().min(1)

export const writingSchema = z
  .object({
    intro: text,
    // Qué sistema de romanización se usa (pinyin, Hepburn…) y para qué sirve.
    romanization: text,
    // Cómo agregar el teclado en Windows y escribir con él.
    keyboard: text,
    groups: z
      .array(
        z.object({
          title: text,
          description: text,
          characters: z
            .array(
              z.object({
                char: text,
                roman: text,
                example: z.object({ word: text, roman: text, es: text })
              })
            )
            .min(2)
            .max(30)
        })
      )
      .min(3)
      .max(20)
  })
  .strict()

export type WritingCourse = z.infer<typeof writingSchema>
