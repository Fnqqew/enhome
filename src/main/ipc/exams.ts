// Pruebas: examen semanal, simulacros y certificados.

import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { loadSettings } from '../db/settings-repo'
import { certificateHtml, certificates } from '../rewards/certificates'
import { CEFR_LEVELS } from '../../shared/curriculum'
import { exerciseAnswerSchema } from '../../shared/exercises'
import { IPC } from '../../shared/ipc'
import { languageInfo } from '../../shared/languages'
import { handle, id, type IpcContext } from './context'

export function registerExams(ctx: IpcContext): void {
  const { db, courseDb, activeLanguage, services, today } = ctx

  handle(IPC.testsOverview, () => services().exams.getOverview(today()))
  handle(IPC.missionGet, () => services().missions.get(today()))
  handle(IPC.missionCreate, (mode) => services().missions.create(z.enum(['write', 'speak']).parse(mode), today()))
  handle(IPC.missionSubmit, (answer) => services().missions.submit(z.string().max(4000).parse(answer), today()))
  handle(IPC.examLock, () => services().exams.hasBlockingExam())
  handle(IPC.examStartWeekly, () => services().exams.startWeekly(today()))
  handle(IPC.examStartMock, (scope, subtopicId) =>
    services().exams.startMock(
      z.enum(['topic', 'general', 'subtopic']).parse(scope),
      today(),
      z.string().nullable().optional().parse(subtopicId) ?? null
    )
  )
  handle(IPC.examResume, (examId) => services().exams.resume(id.parse(examId), today()))
  handle(IPC.examSave, (examId, index, answer) =>
    services().exams.saveAnswer(id.parse(examId), z.number().int().min(0).parse(index), answer === null ? null : exerciseAnswerSchema.parse(answer))
  )
  handle(IPC.examHeartbeat, (examId) => services().exams.heartbeat(id.parse(examId)))
  handle(IPC.examSubmit, (examId) => services().exams.submit(id.parse(examId), today()))
  handle(IPC.examResult, (examId) => services().exams.getResult(id.parse(examId)))
  handle(IPC.examDiscard, (examId) => services().exams.discardMock(id.parse(examId)))

  const certificateFor = (level: unknown): string => {
    const parsed = z.enum(CEFR_LEVELS).parse(level)
    const cert = certificates(courseDb(activeLanguage()), services().curriculum).find((c) => c.level === parsed)
    if (!cert?.complete) throw new Error('Ese nivel todavía no está completo.')
    return certificateHtml(cert, activeLanguage(), loadSettings(db).studentName)
  }
  handle(IPC.certificatesList, () => certificates(courseDb(activeLanguage()), services().curriculum))
  handle(IPC.certificateHtml, (level) => certificateFor(level))
  // El diploma se imprime a PDF en una ventana oculta y se guarda donde elija el alumno.
  handle(IPC.certificatePdf, async (level) => {
    const html = certificateFor(level)
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await win.webContents.printToPDF({
        landscape: true,
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      const language = languageInfo(activeLanguage()).name
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar certificado',
        defaultPath: `Certificado ${String(level)} de ${language} - Enhome.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return null
      await writeFile(filePath, pdf)
      return filePath
    } finally {
      win.destroy()
    }
  })
}
