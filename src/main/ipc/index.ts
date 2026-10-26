// Los canales entre la interfaz y el proceso principal, ordenados por área (un archivo cada una).

import { loadSettings } from '../db/settings-repo'
import { goalView } from '../goal/goal'
import type { DayStatus } from '../reminders'
import { registerApp } from './app'
import { createContext, type IpcOptions } from './context'
import { registerCourse } from './course'
import { registerExams } from './exams'
import { registerPractice } from './practice'
import { registerReading } from './reading'
import { registerVoice } from './voice'

export type { IpcOptions } from './context'

export function registerIpc(options: IpcOptions): {
  today: () => string
  warmUp: () => void
  dayStatus: () => DayStatus | null
  stopVoice: () => void
} {
  const ctx = createContext(options)
  ctx.applyClaudePrefs(loadSettings(ctx.db))

  registerApp(ctx)
  registerCourse(ctx)
  registerPractice(ctx)
  registerReading(ctx)
  registerExams(ctx)
  const voice = registerVoice(ctx)
  // La voz del curso abierto se baja sola la primera vez (y al cambiar de idioma).
  const warmUp = ctx.warmUp
  ctx.warmUp = (): void => {
    warmUp()
    voice.ensure(ctx.activeLanguage())
  }

  // Para el recordatorio: si falta la práctica de hoy y cómo va la meta del curso abierto.
  const dayStatus = (): DayStatus | null => {
    try {
      const { week } = ctx.state()
      const practicePending = !!week?.canPracticeNow && week.days.some((d) => d.date === ctx.today() && d.status === 'today')
      return { practicePending, goal: goalView(ctx.courseDb(ctx.activeLanguage()), loadSettings(ctx.db).dailyGoal, ctx.today()) }
    } catch {
      return null
    }
  }

  return { today: ctx.today, warmUp: () => ctx.warmUp(), dayStatus, stopVoice: voice.stop }
}
