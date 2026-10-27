// Leer y estudiar: resúmenes, vocabulario, resaltados, lecturas, diario, biblioteca y estadísticas.

import { z } from 'zod'
import { searchLibrary } from '../library/library'
import { addHighlight, listHighlights, removeHighlight, updateHighlightNote } from '../reading/highlights'
import { buildStats } from '../stats/stats'
import { IPC } from '../../shared/ipc'
import { MAX_JOURNAL_LENGTH } from '../../shared/reading'
import { SUMMARY_TYPE_IDS } from '../../shared/summaries'
import { handle, id, rating, type IpcContext } from './context'

const summaryType = z.enum(SUMMARY_TYPE_IDS)

export function registerReading(ctx: IpcContext): void {
  const { courseDb, activeLanguage, services, today } = ctx

  handle(IPC.summariesIndex, () => services().summaries.getIndex(today()))
  handle(IPC.summaryGet, (topicId, type) => services().summaries.getSummary(z.string().parse(topicId), summaryType.parse(type), today()))
  handle(IPC.summaryGenerate, (topicId, type, regenerate) =>
    services().summaries.generateSummary(z.string().parse(topicId), summaryType.parse(type), z.boolean().parse(regenerate), today())
  )
  handle(IPC.summaryRate, (topicId, type, value) =>
    services().summaries.rate(z.string().parse(topicId), summaryType.parse(type), rating.parse(value), today())
  )
  handle(IPC.summaryFavorite, (type, favorite) => services().summaries.setFavorite(summaryType.parse(type), z.boolean().parse(favorite), today()))
  handle(IPC.summaryAsk, (topicId, fragment, question) =>
    services().summaries.ask(z.string().parse(topicId), z.string().parse(fragment), z.string().parse(question), today())
  )

  const wordSchema = z.object({ term: z.string(), translation: z.string(), example: z.string(), exampleEs: z.string(), note: z.string() })
  handle(IPC.vocabLookup, (term, context) => {
    const { vocab, progression } = services()
    const level = vocab.levelOf(progression.getState(today()).week?.topicId ?? null)
    return vocab.lookup(
      z.string().max(200).parse(term),
      z
        .string()
        .max(2000)
        .parse(context ?? ''),
      level
    )
  })
  handle(IPC.vocabSave, (info) => services().vocab.save(wordSchema.parse(info), today()))
  handle(IPC.vocabOverview, () => services().vocab.overview(today()))
  handle(IPC.vocabDue, () => services().vocab.due(today()))
  handle(IPC.vocabReview, (cardId, knew) => services().vocab.review(id.parse(cardId), z.boolean().parse(knew), today()))
  handle(IPC.vocabRemove, (cardId) => services().vocab.remove(id.parse(cardId), today()))
  handle(IPC.vocabSaveSentence, (sentence) => services().vocab.saveSentence(z.string().max(1000).parse(sentence), today()))

  const docKey = z.string().min(1).max(200)
  handle(IPC.highlightsList, (key) => listHighlights(courseDb(activeLanguage()), docKey.parse(key)))
  handle(IPC.highlightAdd, (key, text) => addHighlight(courseDb(activeLanguage()), docKey.parse(key), z.string().parse(text)))
  handle(IPC.highlightNote, (highlightId, note) => updateHighlightNote(courseDb(activeLanguage()), id.parse(highlightId), z.string().parse(note)))
  handle(IPC.highlightRemove, (key, highlightId) => removeHighlight(courseDb(activeLanguage()), docKey.parse(key), id.parse(highlightId)))

  handle(IPC.readingsList, () => services().readings.list())
  handle(IPC.readingGet, (readingId) => services().readings.get(id.parse(readingId)))
  handle(IPC.readingGenerate, (theme) => services().readings.generate(z.string().min(1).max(80).parse(theme), today()))
  handle(IPC.readingAnswer, (readingId, answers) =>
    services().readings.answer(id.parse(readingId), z.array(z.number().int().min(0).max(3)).parse(answers))
  )
  handle(IPC.readingRemove, (readingId) => services().readings.remove(id.parse(readingId)))
  handle(IPC.readingStory, () => services().readings.story(today()))
  handle(IPC.readingNextChapter, () => services().readings.nextChapter(today()))

  handle(IPC.journalGet, () => services().journal.view(today()))
  handle(IPC.journalSave, (text) =>
    services().journal.save(
      z
        .string()
        .max(MAX_JOURNAL_LENGTH * 2)
        .parse(text),
      today()
    )
  )
  handle(IPC.journalCorrect, () => services().journal.correct(today()))

  handle(IPC.librarySearch, (query) =>
    searchLibrary(
      courseDb(activeLanguage()),
      services().curriculum,
      z
        .string()
        .max(200)
        .parse(query ?? '')
    )
  )
  handle(IPC.statsGet, () => buildStats(courseDb(activeLanguage()), services().curriculum, today()))
}
