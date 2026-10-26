// Lo que comparten los canales entre la interfaz y el proceso principal: la base, los servicios de
// cada idioma (se arman la primera vez que se usan), el idioma abierto y la fecha de hoy.

import { ipcMain } from 'electron'
import { z } from 'zod'
import { setClaudeProfile } from '../claude/bridge'
import { setSpanishVariant } from '../claude/quality'
import { loadCurriculum, loadRoadmap } from '../content/curriculum'
import { loadPlacementBank, withPlacementBank } from '../content/placement-bank'
import { applyTopicReviews } from '../content/topic-reviews'
import type { DataManager } from '../data/data'
import type { Db } from '../db/database'
import { loadSettings } from '../db/settings-repo'
import { Placement } from '../engine/placement'
import { generatePlacementQuestions } from '../engine/placement-questions'
import { Progression } from '../engine/progression'
import { Exams } from '../exams/exams'
import { generateExam } from '../exams/generation'
import { Games } from '../games/games'
import { gradeOpenAnswer } from '../practice/ai-grading'
import { bankedGenerator, ExerciseBank } from '../practice/bank'
import { CourseBanks } from '../content/bank'
import { Practice } from '../practice/practice'
import { Journal } from '../reading/journal'
import { Readings } from '../reading/readings'
import { Notebook } from '../review/notebook'
import { Rewards } from '../rewards/rewards'
import { answerAboutText, generateSummary } from '../summaries/generation'
import { Summaries } from '../summaries/summaries'
import { Vocabulary } from '../vocab/vocab'
import { Chats } from '../chat/chat'
import type { CurriculumTopic, Roadmap } from '../../shared/curriculum'
import { toLocalDate } from '../../shared/dates'
import { PRACTICE_RATINGS } from '../../shared/exercises'
import type { Result } from '../../shared/ipc'
import type { CourseSummary, LanguageId } from '../../shared/languages'
import { PRACTICE_LENGTHS, type AppSettings } from '../../shared/settings'

// Envuelve cada handler para que la interfaz reciba un Result en vez de un error de Electron.
export function handle<T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<Result<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      console.error(`[ipc] ${channel}`, err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export const id = z.number().int()
export const rating = z.union(PRACTICE_RATINGS.map((r) => z.literal(r)) as [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>])

export interface Services {
  curriculum: CurriculumTopic[]
  roadmap: Roadmap
  progression: Progression
  placement: Placement
  practice: Practice
  summaries: Summaries
  exams: Exams
  rewards: Rewards
  notebook: Notebook
  games: Games
  vocab: Vocabulary
  readings: Readings
  journal: Journal
  chats: Chats
  bank: ExerciseBank
}

export interface IpcOptions {
  // Base principal: el curso de inglés más los ajustes y comentarios, que son de toda la app.
  db: Db
  // Base de cada curso (la de inglés es la principal). Se abre recién cuando hace falta.
  courseDb: (language: LanguageId) => Db
  // Si el curso ya tiene datos guardados, sin crear la base para averiguarlo.
  courseExists: (language: LanguageId) => boolean
  contentDir: string
  isDev: boolean
  data: DataManager
  onSettingsChange?: (settings: AppSettings) => void
}

export interface IpcContext extends Required<IpcOptions> {
  activeLanguage: () => LanguageId
  services: (language?: LanguageId) => Services
  // Olvida los servicios de un idioma (por ejemplo, después de corregir su temario).
  forget: (language: LanguageId) => void
  today: () => string
  setToday: (date: string | null) => void
  state: () => ReturnType<Progression['getState']>
  warmUp: () => void
  courseSummary: (language: LanguageId) => CourseSummary
  applyClaudePrefs: (settings: AppSettings) => void
}

export function createContext(options: IpcOptions): IpcContext {
  const { db, courseDb, courseExists, contentDir } = options
  const courses = new Map<LanguageId, Services>()
  const activeLanguage = (): LanguageId => loadSettings(db).language

  // Un juego de servicios por idioma, armado la primera vez que se usa; si el temario
  // tiene errores, el mensaje llega a la interfaz.
  const services = (language: LanguageId = activeLanguage()): Services => {
    let found = courses.get(language)
    if (!found) {
      const courseData = courseDb(language)
      // Lo corregido desde la app pisa a lo de los archivos.
      const curriculum = applyTopicReviews(loadCurriculum(contentDir, language), courseData)
      const progression = new Progression(courseData, curriculum)
      const roadmap = loadRoadmap(contentDir, language)
      const bank = new ExerciseBank(courseData, new CourseBanks(contentDir, language))
      found = {
        bank,
        curriculum,
        roadmap,
        progression,
        placement: new Placement(
          courseData,
          curriculum,
          progression,
          withPlacementBank(loadPlacementBank(contentDir, language, curriculum), generatePlacementQuestions)
        ),
        practice: new Practice(courseData, curriculum, progression, bankedGenerator(bank), gradeOpenAnswer, () => {
          const { practiceLength, excludedTypes } = loadSettings(db)
          return { size: PRACTICE_LENGTHS[practiceLength].size, excluded: excludedTypes }
        }),
        summaries: new Summaries(courseData, curriculum, progression, generateSummary, answerAboutText),
        exams: new Exams(courseData, curriculum, progression, generateExam, gradeOpenAnswer),
        rewards: new Rewards(courseData, curriculum, roadmap, progression),
        notebook: new Notebook(courseData, curriculum, gradeOpenAnswer),
        games: new Games(courseData, curriculum, progression),
        vocab: new Vocabulary(courseData, curriculum, language),
        readings: new Readings(courseData, curriculum, progression, language),
        journal: new Journal(courseData, curriculum, progression, language),
        chats: new Chats(courseData, curriculum, progression, language)
      }
      courses.set(language, found)
    }
    return found
  }

  // En desarrollo se puede simular la fecha de hoy.
  let todayOverride: string | null = null
  const today = (): string => todayOverride ?? toLocalDate(new Date())
  const state = (): ReturnType<Progression['getState']> => services().progression.getState(today())

  // Prepara en segundo plano la práctica del día del curso abierto y completa los bancos de los
  // subtemas de la semana a los que les quedan pocos ejercicios sin usar.
  const warmUp = (): void => {
    try {
      const { practice, progression, curriculum, bank } = services()
      practice.warmUp(today())
      const week = progression.getState(today()).week
      const topic = week ? curriculum.find((t) => t.id === week.topicId) : undefined
      if (topic) for (const subtopic of topic.subtopics) bank.topUp({ topic, subtopic, kind: 'lesson' }, today())
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
    const progress = services(language).progression.getState(today())
    return {
      ...empty,
      started: progress.placementDone,
      paused: progress.pausedSince !== null,
      level: progress.level,
      topicTitle: progress.week?.topicTitle ?? null
    }
  }

  // Cómo trabaja Claude (velocidad y variante del español) sale de los ajustes.
  const applyClaudePrefs = (settings: AppSettings): void => {
    setClaudeProfile(settings.claudeMode)
    setSpanishVariant(settings.spanishVariant)
  }

  return {
    onSettingsChange: () => {},
    ...options,
    activeLanguage,
    services,
    forget: (language) => courses.delete(language),
    today,
    setToday: (date) => (todayOverride = date),
    state,
    warmUp,
    courseSummary,
    applyClaudePrefs
  }
}
