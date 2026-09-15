// Pruebas: examen semanal y simulacros.

import type { ExerciseAnswer, ExerciseFeedback, ExerciseType, PublicExercise, StoredExercise } from './exercises'
import type { SecondChanceView } from './rewards'

export type ExamKind = 'weekly' | 'mock'
export type MockScope = 'topic' | 'general'
export type ExamEndReason = 'pause-expired' | 'second-interruption' | 'week-closed'

// Mensaje exacto del error que indica que el examen se interrumpió (la interfaz lo reconoce).
export const EXAM_INTERRUPTED_MESSAGE = 'El examen se interrumpió. Volvé a abrir Pruebas para ver cómo sigue.'

export interface ExamQuestion {
  topicId: string
  subtopicId: string
  exercise: StoredExercise
}

export interface ExamQuestionView {
  index: number
  type: ExerciseType
  topicTitle: string
  subtopicTitle: string
  content: PublicExercise
  answer: ExerciseAnswer | null
  feedback: ExerciseFeedback | null
}

export interface ExamSessionView {
  id: number
  kind: ExamKind
  scope: MockScope | null
  title: string
  questions: ExamQuestionView[]
  pauseUsed: boolean
  secondChance: SecondChanceView
}

export interface ExamBreakdownItem {
  topicTitle: string
  subtopicTitle: string
  correct: number
  total: number
}

export interface ExamOutcomeView {
  nextWeekStart: string | null
  finished: boolean
  retry: boolean
  weakTopics: string[]
}

export interface ExamResultView {
  id: number
  kind: ExamKind
  scope: MockScope | null
  title: string
  grade: number
  passed: boolean | null
  endReason: ExamEndReason | null
  questions: ExamQuestionView[]
  breakdown: ExamBreakdownItem[]
  // Solo al entregar; al abrir un examen del historial es null.
  outcome: ExamOutcomeView | null
}

export interface ExamHistoryItem {
  id: number
  kind: ExamKind
  title: string
  date: string
  grade: number | null
  passed: boolean | null
  status: 'submitted' | 'voided'
  endReason: ExamEndReason | null
}

export interface TestsOverview {
  exam:
    | { state: 'active'; session: ExamSessionView }
    | { state: 'paused'; examId: number; kind: ExamKind; title: string; minutesLeft: number }
    | null
  // Aviso de algo que se resolvió al abrir (anulación o entrega automática).
  notice: string | null
  weekly: { available: boolean; message: string; topicTitle: string | null; preparing: boolean; ready: boolean }
  mock: { available: boolean; reason: string | null; topicTitle: string | null }
  history: ExamHistoryItem[]
}

export type ResumeResult =
  | { state: 'active'; session: ExamSessionView }
  | { state: 'result'; result: ExamResultView }
  | { state: 'voided'; message: string }
