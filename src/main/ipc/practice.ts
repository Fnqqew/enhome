// Practicar: la práctica del día, el repaso de errores, los comodines, los juegos y la charla.

import { z } from 'zod'
import { saveTiming } from '../db/timings-repo'
import { prewarmGrading } from '../practice/ai-grading'
import { MAX_CHAT_MESSAGE } from '../../shared/chat'
import { exerciseAnswerSchema } from '../../shared/exercises'
import { GAME_IDS } from '../../shared/games'
import { IPC } from '../../shared/ipc'
import { handle, id, rating, type IpcContext } from './context'

export function registerPractice(ctx: IpcContext): void {
  const { activeLanguage, services, today } = ctx

  handle(IPC.practiceGet, () => services().practice.getView(today()))
  // Lo que tarda la app en abrir la práctica y en dejar seguir después de responder (metas en Acerca de).
  const timed = async <T>(label: string, run: () => T | Promise<T>): Promise<T> => {
    const started = performance.now()
    const result = await run()
    saveTiming(ctx.db, { label, model: 'app', effort: null, ms: performance.now() - started, attempts: 1, ok: true })
    return result
  }
  handle(IPC.practiceStart, () => {
    prewarmGrading(activeLanguage())
    return timed('práctica · abrir', () => services().practice.start(today()))
  })
  handle(IPC.practiceAnswer, (exerciseId, answer) =>
    timed('veredicto', () => services().practice.answer(id.parse(exerciseId), exerciseAnswerSchema.parse(answer), today()))
  )
  handle(IPC.practiceSkip, (exerciseId) => services().practice.skip(id.parse(exerciseId)))
  handle(IPC.practiceRegrade, (exerciseId) => services().practice.regrade(id.parse(exerciseId), today()))
  handle(IPC.practiceRate, (exerciseId, value) => services().practice.rate(id.parse(exerciseId), rating.parse(value)))
  handle(IPC.practiceFinish, (sessionId) => services().practice.finish(id.parse(sessionId), today()))

  handle(IPC.reviewOverview, () => services().notebook.overview(today()))
  handle(IPC.reviewDue, () => services().notebook.due(today()))
  handle(IPC.reviewExam, (examId) => services().notebook.fromExam(id.parse(examId)))
  handle(IPC.reviewAnswer, (mistakeId, answer) => services().notebook.answer(id.parse(mistakeId), exerciseAnswerSchema.parse(answer), today()))

  handle(IPC.rewardsView, () => services().rewards.getView(today()))
  handle(IPC.rewardsNews, () => services().rewards.takeNews(today()))
  handle(IPC.rewardsHint, (exerciseId) => services().rewards.useHint(id.parse(exerciseId)))
  handle(IPC.rewardsSecondChance, (examId, index) => services().rewards.useSecondChance(id.parse(examId), z.number().int().min(0).parse(index)))

  handle(IPC.gamesDeck, () => services().games.deck(today()))
  handle(IPC.gamesFinish, (game, score) => services().games.finish(z.enum(GAME_IDS).parse(game), z.number().parse(score), today()))

  const suggestionSchema = z.object({ title: z.string().max(120), scenario: z.string().max(600) })
  handle(IPC.chatList, () => ({ chats: services().chats.list(), suggestions: services().chats.suggestions(today()) }))
  handle(IPC.chatGet, (chatId) => services().chats.get(id.parse(chatId)))
  handle(IPC.chatStart, (suggestion) => services().chats.start(suggestionSchema.parse(suggestion), today()))
  handle(IPC.chatSend, (chatId, text, spoken) =>
    services().chats.send(id.parse(chatId), z.string().max(MAX_CHAT_MESSAGE).parse(text), z.boolean().optional().parse(spoken) ?? false)
  )
  handle(IPC.chatRemove, (chatId) => services().chats.remove(id.parse(chatId)))
}
