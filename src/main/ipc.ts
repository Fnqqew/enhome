import { app, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { askClaude, cancelClaude, getClaudeStatus, onClaudeTiming } from './claude/bridge'
import { loadCurriculum, loadRoadmap } from './content/curriculum'
import { buildCurriculumMap } from './content/curriculum-map'
import { loadPlacementBank, withPlacementBank } from './content/placement-bank'
import type { Db } from './db/database'
import { addFeedback, listFeedback, removeFeedback, toggleFeedback } from './db/feedback-repo'
import { newFeedbackSchema } from '../shared/feedback'
import { loadSettings, updateSettings } from './db/settings-repo'
import { saveTiming, timingStats } from './db/timings-repo'
import { currentLogPath } from './log'
import { PRACTICE_LENGTHS, type AppSettings } from '../shared/settings'
import { simulatedExam } from './engine/dev'
import { Placement } from './engine/placement'
import { generatePlacementQuestions } from './engine/placement-questions'
import { Progression } from './engine/progression'
import { gradeOpenAnswer } from './practice/ai-grading'
import { generatePracticePool } from './practice/generation'
import { Practice } from './practice/practice'
import { answerAboutText, generateSummary } from './summaries/generation'
import { Summaries } from './summaries/summaries'
import { Exams } from './exams/exams'
import { generateExam } from './exams/generation'
import { Rewards } from './rewards/rewards'
import { Notebook } from './review/notebook'
import type { CurriculumTopic, Roadmap } from '../shared/curriculum'
import { isValidLocalDate, toLocalDate } from '../shared/dates'
import { exerciseAnswerSchema, PRACTICE_RATINGS } from '../shared/exercises'
import { IPC, type Result, type SampleSentence } from '../shared/ipc'
import { LANGUAGE_IDS, languageInfo, type CourseSummary, type LanguageId } from '../shared/languages'
import { SUMMARY_TYPE_IDS } from '../shared/summaries'

// Envuelve cada handler para que la interfaz reciba un Result en vez de un error de Electron.
function handle<T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<Result<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      console.error(`[ipc] ${channel}`, err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

interface Services {
  curriculum: CurriculumTopic[]
  roadmap: Roadmap
  progression: Progression
  placement: Placement
  practice: Practice
  summaries: Summaries
  exams: Exams
  rewards: Rewards
  notebook: Notebook
}

const summaryType = z.enum(SUMMARY_TYPE_IDS)

const id = z.number().int()
const rating = z.union(PRACTICE_RATINGS.map((r) => z.literal(r)) as [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>])

export interface IpcOptions {
  // Base principal: el curso de inglés más los ajustes y comentarios, que son de toda la app.
  db: Db
  // Base de cada curso (la de inglés es la principal). Se abre recién cuando hace falta.
  courseDb: (language: LanguageId) => Db
  // Si el curso ya tiene datos guardados, sin crear la base para averiguarlo.
  courseExists: (language: LanguageId) => boolean
  contentDir: string
  isDev: boolean
  onSettingsChange?: (settings: AppSettings) => void
}

export function registerIpc({ db, courseDb, courseExists, contentDir, isDev, onSettingsChange = () => {} }: IpcOptions): {
  today: () => string
  warmUp: () => void
} {
  // Un juego de servicios por idioma, armado la primera vez que se usa; si el temario
  // tiene errores, el mensaje llega a la interfaz.
  const courses = new Map<LanguageId, Services>()
  const activeLanguage = (): LanguageId => loadSettings(db).language
  const getServices = (language: LanguageId = activeLanguage()): Services => {
    let services = courses.get(language)
    if (!services) {
      const courseData = courseDb(language)
      const curriculum = loadCurriculum(contentDir, language)
      const progression = new Progression(courseData, curriculum)
      const roadmap = loadRoadmap(contentDir, language)
      services = {
        curriculum,
        roadmap,
        progression,
        placement: new Placement(
          courseData,
          curriculum,
          progression,
          withPlacementBank(loadPlacementBank(contentDir, language, curriculum), generatePlacementQuestions)
        ),
        practice: new Practice(courseData, curriculum, progression, generatePracticePool, gradeOpenAnswer, () => {
          const { practiceLength, excludedTypes } = loadSettings(db)
          return { size: PRACTICE_LENGTHS[practiceLength].size, excluded: excludedTypes }
        }),
        summaries: new Summaries(courseData, curriculum, progression, generateSummary, answerAboutText),
        exams: new Exams(courseData, curriculum, progression, generateExam, gradeOpenAnswer),
        rewards: new Rewards(courseData, curriculum, roadmap, progression),
        notebook: new Notebook(courseData, curriculum, gradeOpenAnswer)
      }
      courses.set(language, services)
    }
    return services
  }

  // En desarrollo se puede simular la fecha de hoy.
  let todayOverride: string | null = null
  const today = (): string => todayOverride ?? toLocalDate(new Date())
  const state = () => getServices().progression.getState(today())

  // Prepara en segundo plano la práctica del día del curso abierto.
  const warmUp = (): void => {
    try {
      getServices().practice.warmUp(today())
    } catch (err) {
      console.error('[practice] No se pudo preparar la práctica al abrir', err)
    }
  }

  // Lo que muestra el selector de idioma: un curso sin datos no se abre para no crear su base.
  const topicCounts = new Map<LanguageId, number>()
  const topicCount = (language: LanguageId): number => {
    if (!topicCounts.has(language)) {
      let count = 0
      try {
        count = loadCurriculum(contentDir, language).length
      } catch {
        // Un curso sin temario todavía se muestra como «próximamente».
      }
      topicCounts.set(language, count)
    }
    return topicCounts.get(language)!
  }
  const courseSummary = (language: LanguageId): CourseSummary => {
    const topics = topicCount(language)
    const empty: CourseSummary = { language, available: topics > 0, started: false, paused: false, level: null, topicTitle: null, topics }
    if (topics === 0 || !courseExists(language)) return empty
    const progress = getServices(language).progression.getState(today())
    return {
      ...empty,
      started: progress.placementDone,
      paused: progress.pausedSince !== null,
      level: progress.level,
      topicTitle: progress.week?.topicTitle ?? null
    }
  }
  handle(IPC.appInfo, () => ({
    isDev,
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    dataDir: app.getPath('userData'),
    repoUrl: 'https://github.com/Fnqqew/enhome'
  }))

  onClaudeTiming((timing) => saveTiming(db, timing))
  handle(IPC.appTimings, () => timingStats(db))
  handle(IPC.claudeCancel, () => cancelClaude())
  // openPath devuelve un texto con el error en vez de lanzarlo.
  const open = async (path: string | null): Promise<void> => {
    if (!path) throw new Error('Todavía no hay un registro de errores.')
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  }
  handle(IPC.appOpenLog, () => open(currentLogPath()))
  handle(IPC.appOpenData, () => open(app.getPath('userData')))

  handle(IPC.feedbackList, () => listFeedback(db))
  handle(IPC.feedbackAdd, (note) => addFeedback(db, newFeedbackSchema.parse(note)))
  handle(IPC.feedbackToggle, (noteId) => toggleFeedback(db, id.parse(noteId)))
  handle(IPC.feedbackRemove, (noteId) => removeFeedback(db, id.parse(noteId)))
  handle(IPC.claudeStatus, () => getClaudeStatus())
  handle(IPC.claudeSample, (): Promise<SampleSentence> =>
    askClaude({
      label: 'prueba de conexión',
      systemPrompt: 'Sos un generador de contenido para una app de idiomas para hispanohablantes. Respondé solo con lo pedido.',
      prompt: `Dame una oración simple en ${languageInfo(activeLanguage()).promptName} de nivel A1 y su traducción al español rioplatense.`,
      schema: z.object({ english: z.string(), spanish: z.string() })
    })
  )

  handle(IPC.settingsGet, () => loadSettings(db))
  handle(IPC.settingsUpdate, (patch) => {
    // Cambiar de idioma en medio de un examen semanal dejaría el examen colgado.
    const next = (patch as Partial<AppSettings> | null)?.language
    if (next && next !== activeLanguage() && getServices().exams.hasBlockingExam()) {
      throw new Error('Entregá el examen semanal antes de cambiar de idioma.')
    }
    const settings = updateSettings(db, patch)
    onSettingsChange(settings)
    if (next) warmUp()
    return settings
  })

  handle(IPC.curriculumList, () => getServices().curriculum)
  handle(IPC.curriculumMap, () => {
    const { curriculum, roadmap, progression } = getServices()
    const state = progression.getState(today())
    return buildCurriculumMap(curriculum, roadmap, progression.getTopicProgress(), state.week?.topicId ?? null, state.placementDone)
  })

  handle(IPC.progressGet, state)
  handle(IPC.coursesList, () => LANGUAGE_IDS.map(courseSummary))
  handle(IPC.coursePause, () => {
    getServices().progression.pause(today())
    return state()
  })
  handle(IPC.courseResume, () => {
    getServices().progression.resume(today())
    return state()
  })
  // Borra el progreso de un curso (no los ajustes ni los comentarios, que son de toda la app).
  handle(IPC.courseReset, (language) => {
    const id = z.enum(LANGUAGE_IDS).parse(language)
    getServices(id).progression.resetProgress()
    return courseSummary(id)
  })
  handle(IPC.practiceComplete, (unitId) => {
    getServices().progression.completeUnit(id.parse(unitId), today())
    return state()
  })
  handle(IPC.recoveryRecord, () => {
    getServices().progression.recordRecoverySession(today())
    return state()
  })

  handle(IPC.placementStart, () => {
    getServices().placement.start()
    return getServices().placement.view(today())
  })
  handle(IPC.placementGet, () => getServices().placement.view(today()))
  handle(IPC.placementSkip, () => {
    getServices().placement.startFromScratch(today())
    return getServices().placement.view(today())
  })
  handle(IPC.placementAnswer, (questionId, choice) =>
    getServices().placement.answer(z.string().parse(questionId), z.number().int().min(-1).max(3).parse(choice), today())
  )

  handle(IPC.practiceGet, () => getServices().practice.getView(today()))
  handle(IPC.practiceStart, () => getServices().practice.start(today()))
  handle(IPC.practiceAnswer, (exerciseId, answer) =>
    getServices().practice.answer(id.parse(exerciseId), exerciseAnswerSchema.parse(answer), today())
  )
  handle(IPC.reviewOverview, () => getServices().notebook.overview(today()))
  handle(IPC.reviewDue, () => getServices().notebook.due(today()))
  handle(IPC.reviewExam, (examId) => getServices().notebook.fromExam(id.parse(examId)))
  handle(IPC.reviewAnswer, (mistakeId, answer) => getServices().notebook.answer(id.parse(mistakeId), exerciseAnswerSchema.parse(answer), today()))
  handle(IPC.practiceSkip, (exerciseId) => getServices().practice.skip(id.parse(exerciseId)))
  handle(IPC.practiceRate, (exerciseId, value) => getServices().practice.rate(id.parse(exerciseId), rating.parse(value)))
  handle(IPC.practiceFinish, (sessionId) => getServices().practice.finish(id.parse(sessionId), today()))

  handle(IPC.summariesIndex, () => getServices().summaries.getIndex(today()))
  handle(IPC.summaryGet, (topicId, type) => getServices().summaries.getSummary(z.string().parse(topicId), summaryType.parse(type), today()))
  handle(IPC.summaryGenerate, (topicId, type, regenerate) =>
    getServices().summaries.generateSummary(z.string().parse(topicId), summaryType.parse(type), z.boolean().parse(regenerate), today())
  )
  handle(IPC.summaryRate, (topicId, type, value) =>
    getServices().summaries.rate(z.string().parse(topicId), summaryType.parse(type), rating.parse(value), today())
  )
  handle(IPC.summaryFavorite, (type, favorite) => getServices().summaries.setFavorite(summaryType.parse(type), z.boolean().parse(favorite), today()))
  handle(IPC.summaryAsk, (topicId, fragment, question) =>
    getServices().summaries.ask(z.string().parse(topicId), z.string().parse(fragment), z.string().parse(question), today())
  )

  handle(IPC.testsOverview, () => getServices().exams.getOverview(today()))
  handle(IPC.examLock, () => getServices().exams.hasBlockingExam())
  handle(IPC.examStartWeekly, () => getServices().exams.startWeekly(today()))
  handle(IPC.examStartMock, (scope) => getServices().exams.startMock(z.enum(['topic', 'general']).parse(scope), today()))
  handle(IPC.examResume, (examId) => getServices().exams.resume(id.parse(examId), today()))
  handle(IPC.examSave, (examId, index, answer) =>
    getServices().exams.saveAnswer(id.parse(examId), z.number().int().min(0).parse(index), answer === null ? null : exerciseAnswerSchema.parse(answer))
  )
  handle(IPC.examHeartbeat, (examId) => getServices().exams.heartbeat(id.parse(examId)))
  handle(IPC.examSubmit, (examId) => getServices().exams.submit(id.parse(examId), today()))
  handle(IPC.examResult, (examId) => getServices().exams.getResult(id.parse(examId)))
  handle(IPC.examDiscard, (examId) => getServices().exams.discardMock(id.parse(examId)))

  handle(IPC.rewardsView, () => getServices().rewards.getView(today()))
  handle(IPC.rewardsNews, () => getServices().rewards.takeNews(today()))
  handle(IPC.rewardsHint, (exerciseId) => getServices().rewards.useHint(id.parse(exerciseId)))
  handle(IPC.rewardsSecondChance, (examId, index) =>
    getServices().rewards.useSecondChance(id.parse(examId), z.number().int().min(0).parse(index))
  )

  if (isDev) {
    handle(IPC.devSetToday, (date) => {
      if (date !== null && !isValidLocalDate(date)) throw new Error('Fecha inválida.')
      todayOverride = date
      return state()
    })
    handle(IPC.devSimulateExam, (grade) => {
      const { curriculum, progression } = getServices()
      const week = progression.getState(today()).week
      if (!week) throw new Error('No hay una semana activa.')
      const topic = curriculum.find((t) => t.id === week.topicId)!
      const prerequisite = curriculum.find((t) => t.id === topic.prerequisites[0])
      progression.submitWeeklyExam(simulatedExam(topic, z.number().min(0).max(10).parse(grade), prerequisite), today())
      return state()
    })
    handle(IPC.devResetProgress, () => {
      getServices().progression.resetProgress()
      return state()
    })
  }

  return { today, warmUp }
}
