// Contrato entre el proceso principal y la interfaz.

import type { CurriculumMap, CurriculumTopic } from './curriculum'
import type { ExerciseAnswer, PracticeRating, PracticeResult, PracticeView } from './exercises'
import type { FeedbackNote, NewFeedback } from './feedback'
import type { CourseSummary, LanguageId } from './languages'
import type { AppInfo, PlacementView, ProgressState } from './progress'
import type { AppSettings } from './settings'
import type { ClaudeAnswer, SummariesIndex, SummaryTypeId, SummaryView } from './summaries'
import type { ExamResultView, ExamSessionView, MockScope, ResumeResult, TestsOverview } from './exams'
import type { ProgressView, RewardNews, SecondChanceResult } from './rewards'
import type { ReviewAnswerResult, ReviewItemView, ReviewOverview } from './review'
import type { GameDeck, GameId, GameResult } from './games'

export const IPC = {
  appInfo: 'app:info',
  appTimings: 'app:timings',
  appOpenLog: 'app:open-log',
  appOpenData: 'app:open-data',
  claudeCancel: 'claude:cancel',
  claudeStatus: 'claude:status',
  claudeSample: 'claude:sample',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  curriculumList: 'curriculum:list',
  curriculumMap: 'curriculum:map',
  progressGet: 'progress:get',
  coursesList: 'courses:list',
  coursePause: 'course:pause',
  courseResume: 'course:resume',
  courseReset: 'course:reset',
  practiceComplete: 'unit:complete',
  recoveryRecord: 'recovery:record',
  placementStart: 'placement:start',
  placementGet: 'placement:get',
  placementSkip: 'placement:skip',
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
  rewardsView: 'rewards:view',
  rewardsNews: 'rewards:news',
  rewardsHint: 'rewards:hint',
  rewardsSecondChance: 'rewards:second-chance',
  gamesDeck: 'games:deck',
  gamesFinish: 'games:finish',
  reviewOverview: 'review:overview',
  reviewDue: 'review:due',
  reviewExam: 'review:exam',
  reviewAnswer: 'review:answer',
  feedbackList: 'feedback:list',
  feedbackAdd: 'feedback:add',
  feedbackToggle: 'feedback:toggle',
  feedbackRemove: 'feedback:remove',
  // Botones de la barra de ventana propia.
  windowMinimize: 'window:minimize',
  windowMaximizeToggle: 'window:maximize-toggle',
  windowClose: 'window:close',
  // Eventos del proceso principal a la interfaz.
  windowState: 'window:state',
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

// Tiempos de Claude por tarea (práctica, corrección, examen…), en milisegundos.
export interface ClaudeTimingStat {
  label: string
  calls: number
  failures: number
  // Intentos extra por respuestas con formato inválido.
  retries: number
  averageMs: number
  // Promedio de los últimos pedidos, para comparar con el general.
  recentMs: number
}

export interface SampleSentence {
  english: string
  spanish: string
}

export interface Api {
  getAppInfo(): Promise<AppInfo>
  getClaudeTimings(): Promise<ClaudeTimingStat[]>
  openLogFile(): Promise<void>
  openDataFolder(): Promise<void>
  getClaudeStatus(): Promise<ClaudeStatus>
  // Corta los pedidos a Claude en curso; devuelve cuántos había.
  cancelClaude(): Promise<number>
  sampleSentence(): Promise<SampleSentence>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getCurriculum(): Promise<CurriculumTopic[]>
  getCurriculumMap(): Promise<CurriculumMap>
  getProgress(): Promise<ProgressState>
  getCourses(): Promise<CourseSummary[]>
  pauseCourse(): Promise<ProgressState>
  resumeCourse(): Promise<ProgressState>
  resetCourse(language: LanguageId): Promise<CourseSummary>
  completePracticeUnit(unitId: number): Promise<ProgressState>
  recordRecoverySession(): Promise<ProgressState>
  startPlacement(): Promise<PlacementView>
  getPlacement(): Promise<PlacementView>
  startFromScratch(): Promise<PlacementView>
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
  getProgressView(): Promise<ProgressView>
  takeRewardNews(): Promise<RewardNews[]>
  usePracticeHint(exerciseId: number): Promise<string>
  useSecondChance(examId: number, index: number): Promise<SecondChanceResult>
  getGameDeck(): Promise<GameDeck>
  finishGame(game: GameId, score: number): Promise<GameResult>
  getReviewOverview(): Promise<ReviewOverview>
  getDueReviews(): Promise<ReviewItemView[]>
  getExamReview(examId: number): Promise<ReviewItemView[]>
  answerReview(mistakeId: number, answer: ExerciseAnswer): Promise<ReviewAnswerResult>
  getFeedback(): Promise<FeedbackNote[]>
  addFeedback(note: NewFeedback): Promise<FeedbackNote[]>
  toggleFeedback(id: number): Promise<FeedbackNote[]>
  removeFeedback(id: number): Promise<FeedbackNote[]>
  minimizeWindow(): void
  toggleMaximizeWindow(): void
  closeWindow(): void
  // Se llama cuando la ventana se maximiza o vuelve a su tamaño; devuelve la función para dejar de escuchar.
  onWindowState(callback: (maximized: boolean) => void): () => void
  // Se llama con la nueva fecha cuando cambia el día; devuelve la función para dejar de escuchar.
  onDayChanged(callback: (today: string) => void): () => void
  // Solo en desarrollo.
  devSetToday(date: string | null): Promise<ProgressState>
  devSimulateExam(grade: number): Promise<ProgressState>
  devResetProgress(): Promise<ProgressState>
}
