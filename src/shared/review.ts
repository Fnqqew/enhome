// Cuaderno de errores: lo que el alumno respondió mal vuelve en repasos espaciados hasta que lo acierta.

import type { ExerciseAnswer, ExerciseFeedback, ExerciseType, PublicExercise } from './exercises'

// Días hasta el próximo repaso según cuántas veces seguidas lo acertó: con la cuarta queda aprendido.
export const REVIEW_INTERVALS = [1, 3, 7, 15] as const
export const REVIEW_STEPS = REVIEW_INTERVALS.length

export type MistakeSource = 'practice' | 'exam'

export interface ReviewItemView {
  id: number
  type: ExerciseType
  content: PublicExercise
  topicTitle: string
  subtopicTitle: string
  // Repasos acertados seguidos (0 a 3).
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
