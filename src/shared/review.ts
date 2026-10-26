// Cuaderno de errores: lo que el alumno respondió mal vuelve en repasos espaciados con FSRS.

import type { ExerciseAnswer, ExerciseFeedback, ExerciseType, PublicExercise } from './exercises'

// Escalones de memoria que se muestran (0 a 3): con el cuarto queda aprendido, aunque siga volviendo
// cada vez más espaciado.
export const REVIEW_STEPS = 4

export type MistakeSource = 'practice' | 'exam'

export interface ReviewItemView {
  id: number
  type: ExerciseType
  content: PublicExercise
  topicTitle: string
  subtopicTitle: string
  // Qué tan firme está en la memoria (0 a 3).
  stage: number
  source: MistakeSource
  // Lo que había respondido cuando se equivocó.
  given: ExerciseAnswer | null
  dueOn: string
}

export interface ReviewOverview {
  dueToday: number
  pending: number
  learned: number
  // Cuántos vencen cada uno de los próximos 7 días (sin contar hoy).
  upcoming: { date: string; count: number }[]
  byTopic: { topicId: string; topicTitle: string; pending: number }[]
}

export interface ReviewAnswerResult {
  feedback: ExerciseFeedback
  stage: number
  learned: boolean
  nextDue: string | null
}
