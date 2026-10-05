// Ejercicios de práctica: lo que genera Claude, lo que ve el alumno y cómo responde.

import { z } from 'zod'
import type { Skill } from './curriculum'
import type { UnitKind } from './progress'

const text = z.string().trim().min(1)
const choiceIndex = z.number().int().min(0).max(3)

export const EXERCISE_TYPES = [
  'multiple_choice',
  'fill_blank',
  'word_order',
  'error_correction',
  'translation',
  'translation_set',
  'dialogue',
  'roleplay',
  'reading',
  'writing'
] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const SKILL_OF_TYPE: Record<ExerciseType, Skill> = {
  multiple_choice: 'grammar',
  fill_blank: 'grammar',
  word_order: 'grammar',
  error_correction: 'grammar',
  translation: 'writing',
  translation_set: 'writing',
  dialogue: 'writing',
  roleplay: 'writing',
  reading: 'reading',
  writing: 'writing'
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  multiple_choice: 'Opción múltiple',
  fill_blank: 'Completar',
  word_order: 'Ordenar la oración',
  error_correction: 'Corregir el error',
  translation: 'Traducir',
  translation_set: 'Tanda de traducción',
  dialogue: 'Conversación',
  roleplay: 'Situación real',
  reading: 'Comprensión lectora',
  writing: 'Escritura'
}

// Los ejercicios largos: se responden en varias partes y los corrige Claude.
export const LONG_TYPES = ['translation_set', 'dialogue', 'roleplay', 'writing'] as const

// Lo que genera Claude (con las respuestas).
export const generatedExerciseSchema = z.union([
  z.object({
    type: z.literal('multiple_choice'),
    instruction: text,
    prompt: text,
    options: z.array(text).min(3).max(4),
    correctIndex: choiceIndex,
    explanation: text
  }),
  z.object({
    type: z.literal('fill_blank'),
    instruction: text,
    sentence: text,
    hint: z.string(),
    answers: z.array(text).min(1),
    explanation: text
  }),
  z.object({
    type: z.literal('word_order'),
    instruction: text,
    sentence: text,
    alternatives: z.array(text),
    translation: text,
    explanation: text
  }),
  z.object({
    type: z.literal('error_correction'),
    instruction: text,
    sentence: text,
    answers: z.array(text).min(1),
    explanation: text
  }),
  z.object({
    type: z.literal('translation'),
    instruction: text,
    spanish: text,
    answers: z.array(text).min(1),
    explanation: text
  }),
  z.object({
    type: z.literal('translation_set'),
    instruction: text,
    // Una historia corta contada en oraciones que el alumno traduce una por una.
    situation: text,
    sentences: z
      .array(z.object({ spanish: text, answers: z.array(text).min(1), explanation: text }))
      .min(3)
      .max(5)
  }),
  z.object({
    type: z.literal('dialogue'),
    instruction: text,
    situation: text,
    script: z
      .array(
        z.union([
          z.object({ role: z.literal('other'), speaker: text, text: text }),
          z.object({ role: z.literal('you'), cue: text, sample: text })
        ])
      )
      .min(4)
      .max(10)
  }),
  z.object({
    type: z.literal('roleplay'),
    instruction: text,
    situation: text,
    goal: text,
    steps: z
      .array(z.object({ cue: text, sample: text }))
      .min(3)
      .max(5)
  }),
  z.object({
    type: z.literal('reading'),
    instruction: text,
    text: text,
    questions: z
      .array(z.object({ prompt: text, options: z.array(text).min(3).max(4), correctIndex: choiceIndex, explanation: text }))
      .min(2)
      .max(3)
  }),
  z.object({
    type: z.literal('writing'),
    instruction: text,
    task: text,
    minWords: z.number().int().min(10).max(150),
    maxWords: z.number().int().min(20).max(250),
    guidance: z.array(text).min(1).max(5),
    sampleAnswer: text
  })
])

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>

// Lo que se guarda: igual a lo generado, con las palabras ya mezcladas para ordenar.
export type StoredExercise =
  | Exclude<GeneratedExercise, { type: 'word_order' }>
  | (Extract<GeneratedExercise, { type: 'word_order' }> & { tokens: string[] })

// Los que corrige Claude en lugar de compararse con una respuesta exacta.
export type OpenExercise = Extract<StoredExercise, { type: 'translation' | 'translation_set' | 'dialogue' | 'roleplay' | 'writing' }>

// Lo que ve el alumno (sin respuestas).
export type PublicExercise =
  | { type: 'multiple_choice'; instruction: string; prompt: string; options: string[] }
  | { type: 'fill_blank'; instruction: string; sentence: string; hint: string }
  | { type: 'word_order'; instruction: string; tokens: string[]; translation: string }
  | { type: 'error_correction'; instruction: string; sentence: string }
  | { type: 'translation'; instruction: string; spanish: string }
  | { type: 'translation_set'; instruction: string; situation: string; sentences: { spanish: string }[] }
  | {
      type: 'dialogue'
      instruction: string
      situation: string
      script: ({ role: 'other'; speaker: string; text: string } | { role: 'you'; cue: string })[]
    }
  | { type: 'roleplay'; instruction: string; situation: string; goal: string; steps: { cue: string }[] }
  | { type: 'reading'; instruction: string; text: string; questions: { prompt: string; options: string[] }[] }
  | { type: 'writing'; instruction: string; task: string; minWords: number; maxWords: number; guidance: string[] }

export const exerciseAnswerSchema = z.union([
  z.object({ type: z.literal('multiple_choice'), choice: choiceIndex }),
  z.object({ type: z.literal('fill_blank'), text: z.string().max(200) }),
  z.object({ type: z.literal('word_order'), tokens: z.array(z.string().max(60)).max(40) }),
  z.object({ type: z.literal('error_correction'), text: z.string().max(500) }),
  z.object({ type: z.literal('translation'), text: z.string().max(500) }),
  z.object({ type: z.literal('translation_set'), texts: z.array(z.string().max(500)).max(5) }),
  z.object({ type: z.literal('dialogue'), texts: z.array(z.string().max(500)).max(5) }),
  z.object({ type: z.literal('roleplay'), texts: z.array(z.string().max(500)).max(5) }),
  z.object({ type: z.literal('reading'), choices: z.array(z.number().int().min(-1).max(3)).max(3) }),
  z.object({ type: z.literal('writing'), text: z.string().max(3000) })
])

export type ExerciseAnswer = z.infer<typeof exerciseAnswerSchema>

export interface ExerciseMistake {
  fragment: string
  correction: string
  explanation: string
}

// Resultado de cada parte de un ejercicio largo: una oración de la tanda, un turno o un paso.
export interface ExercisePart {
  cue: string
  given: string
  expected: string
  correct: boolean
  comment: string
}

export interface ExerciseFeedback {
  correct: boolean
  score: number
  correctAnswer: string | null
  explanation: string
  // Comprensión lectora: resultado por pregunta.
  questionResults?: boolean[]
  // Ejercicios largos: devolución parte por parte.
  parts?: ExercisePart[]
  // Corrección de Claude (traducción y escritura).
  review?: { correctedText: string; comments: string; mistakes: ExerciseMistake[] }
}

export const PRACTICE_RATINGS = [1, 3, 5] as const
export type PracticeRating = (typeof PRACTICE_RATINGS)[number]

export type PracticePurpose = 'unit' | 'recovery'

export interface SessionExerciseView {
  id: number
  slot: number
  type: ExerciseType
  content: PublicExercise
  answer: ExerciseAnswer | null
  feedback: ExerciseFeedback | null
  rating: number | null
  // Pista revelada con un comodín, si se usó.
  hint: string | null
}

export interface SessionView {
  id: number
  purpose: PracticePurpose
  unitIndex: number | null
  kind: UnitKind
  topicTitle: string
  subtopicTitle: string
  exercises: SessionExerciseView[]
  spareCount: number
  hintsAvailable: number
  completed: boolean
  canFinish: boolean
}

export type PracticeView =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'ready'
      topicId: string
      purpose: PracticePurpose
      unitIndex: number | null
      kind: UnitKind
      topicTitle: string
      subtopicTitle: string
      goal: string
      keyPoints: string[]
      examples: { en: string; es: string }[]
    }
  | { status: 'session'; session: SessionView }

export interface PracticeResult {
  purpose: PracticePurpose
  unitIndex: number | null
  correct: number
  total: number
  averageScore: number
}
