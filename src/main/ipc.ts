import { ipcMain } from 'electron'
import { z } from 'zod'
import { askClaude, getClaudeStatus } from './claude/bridge'
import { loadCurriculum } from './content/curriculum'
import type { Db } from './db/database'
import { loadSettings, updateSettings } from './db/settings-repo'
import { simulatedExam } from './engine/dev'
import { Placement } from './engine/placement'
import { generatePlacementQuestions } from './engine/placement-questions'
import { Progression } from './engine/progression'
import { gradeOpenAnswer } from './practice/ai-grading'
import { generatePracticePool } from './practice/generation'
import { Practice } from './practice/practice'
import type { CurriculumTopic } from '../shared/curriculum'
import { isValidLocalDate, toLocalDate } from '../shared/dates'
import { exerciseAnswerSchema, PRACTICE_RATINGS } from '../shared/exercises'
import { IPC, type Result, type SampleSentence } from '../shared/ipc'

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
  progression: Progression
  placement: Placement
  practice: Practice
}

const id = z.number().int()
const rating = z.union(PRACTICE_RATINGS.map((r) => z.literal(r)) as [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>])

export function registerIpc(db: Db, contentDir: string, isDev: boolean): void {
  // Se arma una vez; si el temario tiene errores, el mensaje llega a la interfaz.
  let services: Services | null = null
  const getServices = (): Services => {
    if (!services) {
      const curriculum = loadCurriculum(contentDir)
      const progression = new Progression(db, curriculum)
      services = {
        curriculum,
        progression,
        placement: new Placement(db, curriculum, progression, generatePlacementQuestions),
        practice: new Practice(db, curriculum, progression, generatePracticePool, gradeOpenAnswer)
      }
    }
    return services
  }

  // En desarrollo se puede simular la fecha de hoy.
  let todayOverride: string | null = null
  const today = (): string => todayOverride ?? toLocalDate(new Date())
  const state = () => getServices().progression.getState(today())

  handle(IPC.appInfo, () => ({ isDev }))
  handle(IPC.claudeStatus, () => getClaudeStatus())
  handle(IPC.claudeSample, (): Promise<SampleSentence> =>
    askClaude({
      systemPrompt: 'Sos un generador de contenido para una app de inglés para hispanohablantes. Respondé solo con lo pedido.',
      prompt: 'Dame una oración simple en inglés de nivel A1 y su traducción al español rioplatense.',
      schema: z.object({ english: z.string(), spanish: z.string() })
    })
  )

  handle(IPC.settingsGet, () => loadSettings(db))
  handle(IPC.settingsUpdate, (patch) => updateSettings(db, patch))

  handle(IPC.curriculumList, () => getServices().curriculum)

  handle(IPC.progressGet, state)
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
  handle(IPC.placementAnswer, (questionId, choice) =>
    getServices().placement.answer(z.string().parse(questionId), z.number().int().min(-1).max(3).parse(choice), today())
  )

  handle(IPC.practiceGet, () => getServices().practice.getView(today()))
  handle(IPC.practiceStart, () => getServices().practice.start(today()))
  handle(IPC.practiceAnswer, (exerciseId, answer) =>
    getServices().practice.answer(id.parse(exerciseId), exerciseAnswerSchema.parse(answer))
  )
  handle(IPC.practiceSkip, (exerciseId) => getServices().practice.skip(id.parse(exerciseId)))
  handle(IPC.practiceRate, (exerciseId, value) => getServices().practice.rate(id.parse(exerciseId), rating.parse(value)))
  handle(IPC.practiceFinish, (sessionId) => getServices().practice.finish(id.parse(sessionId), today()))

  if (!isDev) return

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
