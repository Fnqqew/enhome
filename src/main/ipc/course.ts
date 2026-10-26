// El curso: temario, progreso, idiomas, pausa y examen inicial.

import { z } from 'zod'
import { buildCurriculumMap } from '../content/curriculum-map'
import { saveTopicReview, writeTopicFiles } from '../content/topic-reviews'
import { topicSchema } from '../../shared/curriculum'
import { IPC } from '../../shared/ipc'
import { LANGUAGE_IDS } from '../../shared/languages'
import { handle, id, type IpcContext } from './context'

export function registerCourse(ctx: IpcContext): void {
  const { courseDb, contentDir, isDev, activeLanguage, services, today, state } = ctx

  handle(IPC.curriculumList, () => services().curriculum)
  handle(IPC.topicReviewSave, (topicId, edit, markReviewed) => {
    const language = activeLanguage()
    const parsed = z.object({ topic: topicSchema, summary: z.string().min(1).max(50_000) }).parse(edit)
    const updated = saveTopicReview(
      courseDb(language),
      services(language).curriculum,
      z.string().parse(topicId),
      parsed,
      z.boolean().parse(markReviewed),
      today()
    )
    if (isDev) writeTopicFiles(contentDir, language, updated)
    // El temario se vuelve a armar con la corrección la próxima vez que se use.
    ctx.forget(language)
    return updated
  })
  handle(IPC.curriculumMap, () => {
    const { curriculum, roadmap, progression } = services()
    const current = progression.getState(today())
    return buildCurriculumMap(curriculum, roadmap, progression.getTopicProgress(), current.week?.topicId ?? null, current.placementDone)
  })

  handle(IPC.progressGet, state)
  handle(IPC.coursesList, () => LANGUAGE_IDS.map(ctx.courseSummary))
  handle(IPC.coursePause, () => {
    services().progression.pause(today())
    return state()
  })
  handle(IPC.courseResume, () => {
    services().progression.resume(today())
    return state()
  })
  // Borra el progreso de un curso (no los ajustes ni los comentarios, que son de toda la app).
  handle(IPC.courseReset, (language) => {
    const lang = z.enum(LANGUAGE_IDS).parse(language)
    services(lang).progression.resetProgress()
    return ctx.courseSummary(lang)
  })
  handle(IPC.practiceComplete, (unitId) => {
    services().progression.completeUnit(id.parse(unitId), today())
    return state()
  })
  handle(IPC.recoveryRecord, () => {
    services().progression.recordRecoverySession(today())
    return state()
  })

  handle(IPC.placementStart, () => {
    services().placement.start()
    return services().placement.view(today())
  })
  handle(IPC.placementGet, () => services().placement.view(today()))
  handle(IPC.placementSkip, () => {
    services().placement.startFromScratch(today())
    return services().placement.view(today())
  })
  handle(IPC.placementAnswer, (questionId, choice) =>
    services().placement.answer(z.string().parse(questionId), z.number().int().min(-1).max(3).parse(choice), today())
  )
}
