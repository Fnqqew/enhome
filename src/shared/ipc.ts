// Contrato entre el proceso principal y la interfaz.

import type { CurriculumMap, CurriculumTopic } from './curriculum'
import type { ExerciseAnswer, PracticeRating, PracticeResult, PracticeView } from './exercises'
import type { AppInfo, PlacementView, ProgressState } from './progress'
import type { AppSettings } from './settings'
import type { ClaudeAnswer, SummariesIndex, SummaryTypeId, SummaryView } from './summaries'
import type { ExamResultView, ExamSessionView, MockScope, ResumeResult, TestsOverview } from './exams'

export const IPC = {
  appInfo: 'app:info',
  claudeStatus: 'claude:status',
  claudeSample: 'claude:sample',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  curriculumList: 'curriculum:list',
  curriculumMap: 'curriculum:map',
  progressGet: 'progress:get',
  practiceComplete: 'unit:complete',
  recoveryRecord: 'recovery:record',
  placementStart: 'placement:start',
  placementGet: 'placement:get',
  placementAnswer: 'placement:answer',
  practiceGet: 'practice:get',
  practiceStart: 'practice:start',
  practiceAnswer: 'practice:answer',
  practiceSkip: 'practice:skip',
  practiceRate: 'practice:rate',
  practiceFinish: 'practice:finish',
  summariesIndex: 'summaries:index',
  summaryGet: 'summaries:get',
  summaryGenerate: 'summaries:generate',
  summaryRate: 'summaries:rate',
  summaryFavorite: 'summaries:favorite',
  summaryAsk: 'summaries:ask',
  testsOverview: 'tests:overview',
  examLock: 'exam:lock',
  examStartWeekly: 'exam:start-weekly',
  examStartMock: 'exam:start-mock',
  examResume: 'exam:resume',
  examSave: 'exam:save',
  examHeartbeat: 'exam:heartbeat',
  examSubmit: 'exam:submit',
  examResult: 'exam:result',
  examDiscard: 'exam:discard',
  // Evento del proceso principal a la interfaz.
  dayChanged: 'app:day-changed',
  devSetToday: 'dev:set-today',
  devSimulateExam: 'dev:simulate-exam',
  devResetProgress: 'dev:reset-progress'
} as const

// Todas las respuestas IPC viajan envueltas para que los errores lleguen limpios a la interfaz.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type ClaudeStatus =
  | { state: 'ready'; subscription: string | null; email: string | null }
  | { state: 'not-installed' }
  | { state: 'logged-out' }
  | { state: 'no-subscription'; authMethod: string }
  | { state: 'error'; message: string }

export interface SampleSentence {
  english: string
  spanish: string
}

export interface Api {
  getAppInfo(): Promise<AppInfo>
  getClaudeStatus(): Promise<ClaudeStatus>
  sampleSentence(): Promise<SampleSentence>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getCurriculum(): Promise<CurriculumTopic[]>
  getCurriculumMap(): Promise<CurriculumMap>
  getProgress(): Promise<ProgressState>
  completePracticeUnit(unitId: number): Promise<ProgressState>
  recordRecoverySession(): Promise<ProgressState>
  startPlacement(): Promise<PlacementView>
  getPlacement(): Promise<PlacementView>
  answerPlacement(questionId: string, choice: number): Promise<PlacementView>
  getPractice(): Promise<PracticeView>
  startPractice(): Promise<PracticeView>
  answerExercise(exerciseId: number, answer: ExerciseAnswer): Promise<PracticeView>
  skipExercise(exerciseId: number): Promise<PracticeView>
  rateExercise(exerciseId: number, rating: PracticeRating): Promise<PracticeView>
  finishPractice(sessionId: number): Promise<PracticeResult>
  getSummariesIndex(): Promise<SummariesIndex>
  getSummary(topicId: string, type: SummaryTypeId): Promise<SummaryView>
  generateSummary(topicId: string, type: SummaryTypeId, regenerate: boolean): Promise<SummaryView>
  rateSummary(topicId: string, type: SummaryTypeId, rating: PracticeRating): Promise<SummaryView>
  setFavoriteSummaryType(type: SummaryTypeId, favorite: boolean): Promise<SummariesIndex>
  askAboutText(topicId: string, fragment: string, question: string): Promise<ClaudeAnswer>
  getTestsOverview(): Promise<TestsOverview>
  getExamLock(): Promise<boolean>
  startWeeklyExam(): Promise<ExamSessionView>
  startMockExam(scope: MockScope): Promise<ExamSessionView>
  resumeExam(examId: number): Promise<ResumeResult>
  saveExamAnswer(examId: number, index: number, answer: ExerciseAnswer | null): Promise<void>
  examHeartbeat(examId: number): Promise<void>
  submitExam(examId: number): Promise<ExamResultView>
  getExamResult(examId: number): Promise<ExamResultView>
  discardMockExam(examId: number): Promise<void>
  // Se llama con la nueva fecha cuando cambia el día; devuelve la función para dejar de escuchar.
  onDayChanged(callback: (today: string) => void): () => void
  // Solo en desarrollo.
  devSetToday(date: string | null): Promise<ProgressState>
  devSimulateExam(grade: number): Promise<ProgressState>
  devResetProgress(): Promise<ProgressState>
}
