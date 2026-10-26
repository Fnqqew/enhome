// Ejercicios de práctica: lo que genera Claude, lo que ve el alumno y cómo responde.

import { z } from 'zod'
import type { Skill } from './curriculum'
import type { UnitKind } from './progress'

import {
  dialogue,
  errorCorrection,
  EXERCISE_KINDS,
  fillBlank,
  multipleChoice,
  reading,
  roleplay,
  translation,
  translationSet,
  wordOrder,
  writing
} from './exercise-types/registry'
import type { PublicOf, StoredOf } from './exercise-types/kind'

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

// Lo que se deriva de cada tipo de ejercicio (definido en shared/exercise-types).
export const SKILL_OF_TYPE = Object.fromEntries(EXERCISE_TYPES.map((type) => [type, EXERCISE_KINDS[type].skill])) as Record<ExerciseType, Skill>
export const EXERCISE_TYPE_LABELS = Object.fromEntries(EXERCISE_TYPES.map((type) => [type, EXERCISE_KINDS[type].label])) as Record<
  ExerciseType,
  string
>

// Los ejercicios largos: se responden en varias partes y los corrige Claude.
export const LONG_TYPES = ['translation_set', 'dialogue', 'roleplay', 'writing'] as const

// Lo que genera Claude (con las respuestas).
export const generatedExerciseSchema = z.union([
  multipleChoice.generated,
  fillBlank.generated,
  wordOrder.generated,
  errorCorrection.generated,
  translation.generated,
  translationSet.generated,
  dialogue.generated,
  roleplay.generated,
  reading.generated,
  writing.generated
])

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>

type Kinds = typeof EXERCISE_KINDS

// Lo que se guarda: igual a lo generado, con las palabras ya mezcladas para ordenar.
export type StoredExercise = { [T in ExerciseType]: StoredOf<Kinds[T]> }[ExerciseType]

// Los que corrige Claude en lugar de compararse con una respuesta exacta.
export type OpenExercise = Extract<StoredExercise, { type: 'translation' | 'translation_set' | 'dialogue' | 'roleplay' | 'writing' }>

// Lo que ve el alumno (sin respuestas).
export type PublicExercise = { [T in ExerciseType]: PublicOf<Kinds[T]> }[ExerciseType]

export const exerciseAnswerSchema = z.union([
  multipleChoice.answer,
  fillBlank.answer,
  wordOrder.answer,
  errorCorrection.answer,
  translation.answer,
  translationSet.answer,
  dialogue.answer,
  roleplay.answer,
  reading.answer,
  writing.answer
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
  // Respondido y esperando la corrección de Claude (se puede seguir con el próximo mientras tanto).
  grading: boolean
  // Si la corrección de Claude falló, por qué; con «Reintentar» se vuelve a pedir.
  gradingError: string | null
}

export interface SessionView {
  id: number
  topicId: string
  purpose: PracticePurpose
  unitIndex: number | null
  kind: UnitKind
  topicTitle: string
  subtopicTitle: string
  exercises: SessionExerciseView[]
  spareCount: number
  hintsAvailable: number
  completed: boolean
  // Lugares de los ejercicios largos que todavía están llegando (la sesión empezó con los cortos).
  pendingCount: number
  // Si fallaron los largos, por qué; con «Reintentar» se vuelven a pedir.
  pendingError: string | null
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
      examples: { target: string; es: string }[]
    }
  | { status: 'session'; session: SessionView }

export interface PracticeResult {
  purpose: PracticePurpose
  unitIndex: number | null
  correct: number
  total: number
  averageScore: number
}
