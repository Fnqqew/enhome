// Contrato entre el proceso principal y la interfaz.

import type { CefrLevel, CurriculumMap, CurriculumTopic, Topic } from './curriculum'
import type { CertificateView } from './certificates'
import type { StatsView } from './stats'
import type { BackupInfo } from './data'
import type { GoalView } from './goal'
import type { LibraryResult } from './library'
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
import type { VocabCard, VocabOverview, WordInfo } from './vocab'
import type { Highlight, JournalView, ReadingSummary, ReadingView } from './reading'
import type { ChatSuggestion, ChatSummary, ChatView } from './chat'
import type { UpdateInfo } from './updates'
import type { VoiceRole, VoiceStatus } from './voice'

export const IPC = {
  appInfo: 'app:info',
  appTimings: 'app:timings',
  appOpenLog: 'app:open-log',
  appOpenData: 'app:open-data',
  updatesCheck: 'updates:check',
  updatesInstall: 'updates:install',
  modelsSize: 'models:size',
  studyAdd: 'study:add',
  goalGet: 'goal:get',
  navigate: 'app:navigate',
  dataBackups: 'data:backups',
  dataBackupNow: 'data:backup-now',
  dataRestore: 'data:restore',
  dataExport: 'data:export',
  dataImport: 'data:import',
  dataDeleteAll: 'data:delete-all',
  modelsRemove: 'models:remove',
  claudeCancel: 'claude:cancel',
  claudeStatus: 'claude:status',
  claudeSample: 'claude:sample',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  curriculumList: 'curriculum:list',
  curriculumMap: 'curriculum:map',
  topicReviewSave: 'topic-review:save',
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
  practiceRegrade: 'practice:regrade',
  voiceList: 'voice:list',
  voiceInstall: 'voice:install',
  voiceRemove: 'voice:remove',
  voiceSpeak: 'voice:speak',
  voicePrefetch: 'voice:prefetch',
  voiceChanged: 'voice:changed',
  practiceGraded: 'practice:graded',
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
  certificatesList: 'certificates:list',
  statsGet: 'stats:get',
  librarySearch: 'library:search',
  certificateHtml: 'certificate:html',
  certificatePdf: 'certificate:pdf',
  rewardsHint: 'rewards:hint',
  rewardsSecondChance: 'rewards:second-chance',
  vocabLookup: 'vocab:lookup',
  vocabSave: 'vocab:save',
  vocabOverview: 'vocab:overview',
  vocabDue: 'vocab:due',
  vocabReview: 'vocab:review',
  vocabRemove: 'vocab:remove',
  vocabSaveSentence: 'vocab:save-sentence',
  chatList: 'chat:list',
  chatGet: 'chat:get',
  chatStart: 'chat:start',
  chatSend: 'chat:send',
  chatRemove: 'chat:remove',
  highlightsList: 'highlights:list',
  highlightAdd: 'highlight:add',
  highlightNote: 'highlight:note',
  highlightRemove: 'highlight:remove',
  readingsList: 'readings:list',
  readingGet: 'reading:get',
  readingGenerate: 'reading:generate',
  readingAnswer: 'reading:answer',
  readingRemove: 'reading:remove',
  journalGet: 'journal:get',
  journalSave: 'journal:save',
  journalCorrect: 'journal:correct',
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
// Metas de tiempo del plan 3.0: lo que mide la app y cuánto debería tardar como mucho.
export const TIME_GOALS = [
  { label: 'práctica · abrir', title: 'Abrir la práctica', goalMs: 1_000 },
  { label: 'veredicto', title: 'Responder y seguir', goalMs: 200 },
  { label: 'corrección', title: 'Explicación de Claude', goalMs: 8_000 }
] as const

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
  // Versiones publicadas en GitHub: buscar una nueva e instalarla (cierra la app).
  checkUpdates(): Promise<UpdateInfo>
  installUpdate(): Promise<void>
  // Bytes que ocupan los modelos de voz descargados, y borrarlos.
  getModelsSize(): Promise<number>
  // Suma segundos de estudio activo de hoy (para la meta en minutos).
  addStudyTime(seconds: number): Promise<void>
  getGoal(): Promise<GoalView>
  // El proceso principal pide abrir una sección (desde la bandeja o una notificación).
  onNavigate(callback: (section: string) => void): () => void
  getBackups(): Promise<BackupInfo[]>
  backupNow(): Promise<BackupInfo | null>
  // Restaurar, importar y borrar reinician la app.
  restoreBackup(date: string): Promise<void>
  exportData(): Promise<string | null>
  importData(): Promise<boolean>
  deleteAllData(): Promise<void>
  removeModels(): Promise<void>
  getClaudeStatus(): Promise<ClaudeStatus>
  // Corta los pedidos a Claude en curso; devuelve cuántos había.
  cancelClaude(): Promise<number>
  sampleSentence(): Promise<SampleSentence>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getCurriculum(): Promise<CurriculumTopic[]>
  getCurriculumMap(): Promise<CurriculumMap>
  // Guarda lo corregido de un tópico y, si se pide, lo marca como revisado.
  saveTopicReview(topicId: string, edit: { topic: Topic; summary: string }, markReviewed: boolean): Promise<CurriculumTopic>
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
  // Voces neuronales del idioma del curso (y la del español): cuáles hay, bajarlas y hablar.
  listVoices(): Promise<VoiceStatus[]>
  installVoice(voiceId: string): Promise<void>
  removeVoice(voiceId: string): Promise<void>
  // El audio (WAV) de un texto; null si no hay voz neural bajada para ese idioma (se usa la de Windows).
  speakNeural(text: string, lang: string, speed: number, role: VoiceRole): Promise<Uint8Array | null>
  prefetchVoice(texts: string[], lang: string, role: VoiceRole): Promise<void>
  onVoiceChanged(callback: () => void): () => void
  // Vuelve a pedir la corrección de Claude que falló.
  regradeExercise(exerciseId: number): Promise<PracticeView>
  // Avisa cuando llega una corrección de Claude (para actualizar la práctica).
  onPracticeGraded(callback: () => void): () => void
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
  startMockExam(scope: MockScope, subtopicId?: string): Promise<ExamSessionView>
  resumeExam(examId: number): Promise<ResumeResult>
  saveExamAnswer(examId: number, index: number, answer: ExerciseAnswer | null): Promise<void>
  examHeartbeat(examId: number): Promise<void>
  submitExam(examId: number): Promise<ExamResultView>
  getExamResult(examId: number): Promise<ExamResultView>
  discardMockExam(examId: number): Promise<void>
  getProgressView(): Promise<ProgressView>
  takeRewardNews(): Promise<RewardNews[]>
  getCertificates(): Promise<CertificateView[]>
  getStats(): Promise<StatsView>
  searchLibrary(query: string): Promise<LibraryResult[]>
  getCertificateHtml(level: CefrLevel): Promise<string>
  // Devuelve dónde se guardó, o null si se canceló.
  saveCertificatePdf(level: CefrLevel): Promise<string | null>
  usePracticeHint(exerciseId: number): Promise<string>
  useSecondChance(examId: number, index: number): Promise<SecondChanceResult>
  lookupWord(term: string, context: string): Promise<WordInfo & { saved: boolean }>
  saveWord(info: WordInfo): Promise<VocabOverview>
  getVocab(): Promise<VocabOverview>
  getDueWords(): Promise<VocabCard[]>
  reviewWord(cardId: number, knew: boolean): Promise<VocabCard>
  removeWord(cardId: number): Promise<VocabOverview>
  saveSentence(sentence: string): Promise<VocabOverview>
  getChats(): Promise<{ chats: ChatSummary[]; suggestions: ChatSuggestion[] }>
  getChat(chatId: number): Promise<ChatView>
  startChat(suggestion: ChatSuggestion): Promise<ChatView>
  sendChat(chatId: number, text: string): Promise<ChatView>
  removeChat(chatId: number): Promise<ChatSummary[]>
  getHighlights(docKey: string): Promise<Highlight[]>
  addHighlight(docKey: string, text: string): Promise<Highlight[]>
  noteHighlight(highlightId: number, note: string): Promise<void>
  removeHighlight(docKey: string, highlightId: number): Promise<Highlight[]>
  getReadings(): Promise<ReadingSummary[]>
  getReading(readingId: number): Promise<ReadingView>
  generateReading(theme: string): Promise<ReadingView>
  answerReading(readingId: number, answers: number[]): Promise<ReadingView>
  removeReading(readingId: number): Promise<ReadingSummary[]>
  getJournal(): Promise<JournalView>
  saveJournal(text: string): Promise<JournalView>
  correctJournal(): Promise<JournalView>
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
