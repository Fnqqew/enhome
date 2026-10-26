// Ejercicios de elegir: opción múltiple y comprensión lectora.

import { z } from 'zod'
import { shuffleChoices } from '../shuffle'
import { choiceIndex, graded, text, type ExerciseKind } from './kind'
import { normalize, quoted } from './text'

function assertIndex(index: number, length: number): void {
  if (index >= length) throw new Error('La opción correcta está fuera de rango.')
}

export function assertDistinct(options: string[]): void {
  if (new Set(options.map((o) => normalize(o))).size !== options.length) throw new Error('Hay opciones repetidas.')
}

// Opción múltiple

const mcGenerated = z.object({
  type: z.literal('multiple_choice'),
  instruction: text,
  prompt: text,
  options: z.array(text).min(3).max(4),
  correctIndex: choiceIndex,
  explanation: text,
  // Por qué cada opción está bien o mal, en el mismo orden que options (opcional).
  optionNotes: z.array(z.string()).min(3).max(4).optional()
})
type McGenerated = z.infer<typeof mcGenerated>
const mcAnswer = z.object({ type: z.literal('multiple_choice'), choice: choiceIndex })
type McAnswer = z.infer<typeof mcAnswer>
export interface McPublic {
  type: 'multiple_choice'
  instruction: string
  prompt: string
  options: string[]
}

export const multipleChoice: ExerciseKind<McGenerated, McGenerated, McPublic, McAnswer> = {
  type: 'multiple_choice',
  label: 'Opción múltiple',
  skill: 'grammar',
  long: false,
  generated: mcGenerated,
  answer: mcAnswer,
  prepare: (e, random) => {
    assertIndex(e.correctIndex, e.options.length)
    assertDistinct(e.options)
    if (e.optionNotes && e.optionNotes.length !== e.options.length) throw new Error('Las notas no coinciden con las opciones.')
    const shuffled = shuffleChoices(e.options, e.correctIndex, random)
    // Las notas siguen a su opción al mezclar.
    const optionNotes = e.optionNotes ? shuffled.options.map((option) => e.optionNotes![e.options.indexOf(option)]) : undefined
    return { ...e, ...shuffled, ...(optionNotes ? { optionNotes } : {}) }
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, prompt: e.prompt, options: e.options }),
  mainText: (e) => e.prompt,
  grade: (e, a) => {
    const right = a.choice === e.correctIndex
    const note = !right && a.choice >= 0 ? e.optionNotes?.[a.choice]?.trim() : ''
    return graded(right, e.options[e.correctIndex], note ? `${note} ${e.explanation}` : e.explanation)
  },
  empty: (e) => ({ type: e.type, choice: -1 }),
  retry: (e, a) => (a.choice >= 0 ? e.optionNotes?.[a.choice]?.trim() : '') || 'Esa no es. Releé la oración y pensá qué regla del subtema se aplica.',
  hint: (e) => {
    const wrong = e.options.filter((_, i) => i !== e.correctIndex)
    return `Descartá ${quoted(wrong.slice(0, Math.max(1, e.options.length - 2)))}.`
  },
  guide: ({ language }) =>
    `multiple_choice: prompt en ${language} (marcá el hueco con ___ si corresponde); 4 opciones con una sola correcta; correctIndex es su posición (0 a 3); optionNotes con una frase breve en español por opción, en el mismo orden, que diga por qué está bien o mal (los distractores tienen que ser errores típicos de hispanohablantes).`,
  check: 'multiple_choice: solo una opción es correcta en cualquier contexto razonable.'
}

// Comprensión lectora

const question = z.object({ prompt: text, options: z.array(text).min(3).max(4), correctIndex: choiceIndex, explanation: text })
const readingGenerated = z.object({
  type: z.literal('reading'),
  instruction: text,
  text: text,
  questions: z.array(question).min(2).max(3)
})
type ReadingGenerated = z.infer<typeof readingGenerated>
const readingAnswer = z.object({ type: z.literal('reading'), choices: z.array(z.number().int().min(-1).max(3)).max(3) })
type ReadingAnswer = z.infer<typeof readingAnswer>
export interface ReadingPublic {
  type: 'reading'
  instruction: string
  text: string
  questions: { prompt: string; options: string[] }[]
}

export const reading: ExerciseKind<ReadingGenerated, ReadingGenerated, ReadingPublic, ReadingAnswer> = {
  type: 'reading',
  label: 'Comprensión lectora',
  skill: 'reading',
  long: false,
  generated: readingGenerated,
  answer: readingAnswer,
  prepare: (e, random) => ({
    ...e,
    questions: e.questions.map((q) => {
      assertIndex(q.correctIndex, q.options.length)
      assertDistinct(q.options)
      return { ...q, ...shuffleChoices(q.options, q.correctIndex, random) }
    })
  }),
  toPublic: (e) => ({
    type: e.type,
    instruction: e.instruction,
    text: e.text,
    questions: e.questions.map((q) => ({ prompt: q.prompt, options: q.options }))
  }),
  mainText: (e) => e.text.slice(0, 80),
  grade: (e, a) => {
    const results = e.questions.map((q, i) => a.choices[i] === q.correctIndex)
    const right = results.filter(Boolean).length
    return {
      kind: 'graded',
      feedback: {
        correct: right === results.length,
        score: Math.round((right * 10) / results.length),
        correctAnswer: e.questions.map((q, i) => `${i + 1}. ${q.options[q.correctIndex]}`).join('\n'),
        explanation: e.questions.map((q) => q.explanation).join(' '),
        questionResults: results
      }
    }
  },
  empty: (e) => ({ type: e.type, choices: [] }),
  hint: (e) => e.questions.map((q, i) => `Pregunta ${i + 1}: descartá «${q.options.find((_, k) => k !== q.correctIndex)}».`).join(' '),
  guide: ({ language }) =>
    `reading: text en ${language} con 2 o 3 preguntas de opción múltiple (4 opciones, una correcta). Extensión: A1 y A2, de 90 a 140 palabras; B1, de 140 a 200; B2, de 180 a 250; C1 y C2, de 220 a 300.`,
  check: 'reading: cada respuesta se deduce del texto y solo una opción es correcta.'
}
