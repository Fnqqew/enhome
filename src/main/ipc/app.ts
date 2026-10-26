// La app en sí: versión, actualizaciones, Claude, ajustes, datos, comentarios y herramientas de prueba.

import { app, dialog, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { askClaude, cancelClaude, getClaudeStatus, onClaudeTiming } from '../claude/bridge'
import { spanish } from '../claude/quality'
import { addFeedback, listFeedback, removeFeedback, toggleFeedback } from '../db/feedback-repo'
import { loadSettings, updateSettings } from '../db/settings-repo'
import { saveTiming, timingStats } from '../db/timings-repo'
import { simulatedExam } from '../engine/dev'
import { addStudyTime, goalView } from '../goal/goal'
import { currentLogPath } from '../log'
import { modelsSize, removeModels } from '../models'
import { checkUpdates, installUpdate, REPO } from '../updates'
import { isValidLocalDate } from '../../shared/dates'
import { newFeedbackSchema } from '../../shared/feedback'
import { IPC, type SampleSentence } from '../../shared/ipc'
import { languageInfo } from '../../shared/languages'
import type { AppSettings } from '../../shared/settings'
import { handle, id, type IpcContext } from './context'

export function registerApp(ctx: IpcContext): void {
  const { db, courseDb, data, isDev, activeLanguage, today, state } = ctx

  handle(IPC.appInfo, () => ({
    isDev,
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    dataDir: app.getPath('userData'),
    repoUrl: `https://github.com/${REPO}`
  }))
  handle(IPC.updatesCheck, () => checkUpdates())
  handle(IPC.updatesInstall, () =>
    installUpdate(() => {
      // Se da tiempo a que la respuesta llegue a la ventana antes de cerrar.
      setTimeout(() => app.quit(), 300)
    })
  )

  onClaudeTiming((timing) => saveTiming(db, timing))
  handle(IPC.appTimings, () => timingStats(db))
  handle(IPC.claudeCancel, () => cancelClaude())
  handle(IPC.claudeStatus, () => getClaudeStatus())
  handle(IPC.claudeSample, (): Promise<SampleSentence> =>
    askClaude({
      label: 'prueba de conexión',
      systemPrompt: 'Sos un generador de contenido para una app de idiomas para hispanohablantes. Respondé solo con lo pedido.',
      prompt: `Dame una oración simple en ${languageInfo(activeLanguage()).promptName} de nivel A1 y su traducción al ${spanish()}.`,
      schema: z.object({ english: z.string(), spanish: z.string() })
    })
  )
  handle(IPC.modelsSize, () => modelsSize())
  handle(IPC.modelsRemove, () => removeModels())
  handle(IPC.studyAdd, (seconds) => addStudyTime(courseDb(activeLanguage()), today(), z.number().parse(seconds)))
  handle(IPC.goalGet, () => goalView(courseDb(activeLanguage()), loadSettings(db).dailyGoal, today()))

  // Datos: copias, exportar, importar y borrar. Lo que reemplaza las bases reinicia la app.
  const relaunch = (): void => {
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 300)
  }
  handle(IPC.dataBackups, () => data.backups())
  handle(IPC.dataBackupNow, () => data.backup(today(), true))
  handle(IPC.dataRestore, (date) => {
    data.restore(z.string().parse(date))
    relaunch()
  })
  handle(IPC.dataExport, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar el progreso',
      defaultPath: `Enhome ${today()}.enhome`,
      filters: [{ name: 'Progreso de Enhome', extensions: ['enhome'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, data.exportData(app.getVersion()))
    return filePath
  })
  handle(IPC.dataImport, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Importar el progreso',
      filters: [{ name: 'Progreso de Enhome', extensions: ['enhome'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return false
    data.importData(await readFile(filePaths[0]), today())
    relaunch()
    return true
  })
  handle(IPC.dataDeleteAll, () => {
    data.backup(today(), true)
    data.deleteAll()
    relaunch()
  })

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

  handle(IPC.settingsGet, () => loadSettings(db))
  handle(IPC.settingsUpdate, (patch) => {
    // Cambiar de idioma en medio de un examen semanal dejaría el examen colgado.
    const next = (patch as Partial<AppSettings> | null)?.language
    if (next && next !== activeLanguage() && ctx.services().exams.hasBlockingExam()) {
      throw new Error('Entregá el examen semanal antes de cambiar de idioma.')
    }
    const settings = updateSettings(db, patch)
    ctx.applyClaudePrefs(settings)
    ctx.onSettingsChange(settings)
    if (next) ctx.warmUp()
    return settings
  })

  if (isDev) {
    handle(IPC.devSetToday, (date) => {
      if (date !== null && !isValidLocalDate(date)) throw new Error('Fecha inválida.')
      ctx.setToday(date as string | null)
      return state()
    })
    handle(IPC.devSimulateExam, (grade) => {
      const { curriculum, progression } = ctx.services()
      const week = progression.getState(today()).week
      if (!week) throw new Error('No hay una semana activa.')
      const topic = curriculum.find((t) => t.id === week.topicId)!
      const prerequisite = curriculum.find((t) => t.id === topic.prerequisites[0])
      progression.submitWeeklyExam(simulatedExam(topic, z.number().min(0).max(10).parse(grade), prerequisite), today())
      return state()
    })
    handle(IPC.devResetProgress, () => {
      ctx.services().progression.resetProgress()
      return state()
    })
  }
}
