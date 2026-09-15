// Resúmenes por tópico: el base del temario y los tipos que genera Claude, con favoritos y calificaciones.

import type { CurriculumTopic } from '../../shared/curriculum'
import type { PracticeRating } from '../../shared/exercises'
import {
  BASE_SUMMARY_TYPE,
  SUMMARY_TYPE_IDS,
  SUMMARY_TYPES,
  type ClaudeAnswer,
  type GeneratedSummaryType,
  type SummariesIndex,
  type SummaryContent,
  type SummaryTopicOption,
  type SummaryTypeId,
  type SummaryTypeView,
  type SummaryView
} from '../../shared/summaries'
import type { Db } from '../db/database'
import { loadSettings, updateSettings } from '../db/settings-repo'
import type { Progression } from '../engine/progression'

export class SummaryError extends Error {}

export type SummaryGenerator = (topic: CurriculumTopic, type: GeneratedSummaryType) => Promise<SummaryContent>
export type TextAsker = (request: { topic: CurriculumTopic; fragment: string; question: string }) => Promise<string>

const RECOMMENDED_RATING = 4
const NEUTRAL_RATING = 3
const MAX_FRAGMENT_LENGTH = 2000
const MAX_QUESTION_LENGTH = 500
const DEFAULT_QUESTION = 'Explicame esto con otras palabras y con un ejemplo.'

interface SummaryRow {
  content: string
  source: 'base' | 'ai'
  user_rating: number | null
  created_at: string
}

export class Summaries {
  private readonly generating = new Map<string, Promise<void>>()
  private readonly topics: Map<string, CurriculumTopic>

  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly generate: SummaryGenerator,
    private readonly askAbout: TextAsker
  ) {
    this.topics = new Map(curriculum.map((t) => [t.id, t]))
  }

  getIndex(today: string): SummariesIndex {
    const state = this.progression.getState(today)
    if (!state.placementDone) return { unlocked: false, reason: 'Hacé el examen inicial desde Inicio para desbloquear los resúmenes de tu recorrido.' }
    return { unlocked: true, currentTopicId: state.week?.topicId ?? null, topics: this.unlockedTopics(today), types: this.typeViews() }
  }

  getSummary(topicId: string, type: SummaryTypeId, today: string): SummaryView {
    return this.view(this.accessibleTopic(topicId, today), type)
  }

  async generateSummary(topicId: string, type: SummaryTypeId, regenerate: boolean, today: string): Promise<SummaryView> {
    const topic = this.accessibleTopic(topicId, today)
    if (type === BASE_SUMMARY_TYPE) throw new SummaryError('La explicación completa ya viene con el temario.')
    if (!regenerate && this.row(topic.id, type)) return this.view(topic, type)

    const key = `${topic.id}/${type}`
    let pending = this.generating.get(key)
    if (!pending) {
      pending = this.generate(topic, type)
        .then((content) => {
          this.db
            .prepare(
              `INSERT INTO summaries (topic_id, type, content, source) VALUES (?, ?, ?, 'ai')
               ON CONFLICT (topic_id, type) DO UPDATE SET content = excluded.content, source = 'ai', user_rating = NULL, created_at = datetime('now')`
            )
            .run(topic.id, type, JSON.stringify(content))
        })
        .finally(() => this.generating.delete(key))
      this.generating.set(key, pending)
    }
    await pending
    return this.view(topic, type)
  }

  rate(topicId: string, type: SummaryTypeId, rating: PracticeRating, today: string): SummaryView {
    const topic = this.accessibleTopic(topicId, today)
    if (type === BASE_SUMMARY_TYPE) {
      // El resumen base no se guarda en la tabla: se crea una fila solo para su calificación.
      this.db
        .prepare(
          `INSERT INTO summaries (topic_id, type, content, source, user_rating) VALUES (?, ?, '', 'base', ?)
           ON CONFLICT (topic_id, type) DO UPDATE SET user_rating = excluded.user_rating`
        )
        .run(topic.id, type, rating)
    } else {
      if (!this.row(topic.id, type)) throw new SummaryError('Primero generá este resumen.')
      this.db.prepare('UPDATE summaries SET user_rating = ? WHERE topic_id = ? AND type = ?').run(rating, topic.id, type)
    }
    return this.view(topic, type)
  }

  setFavorite(type: SummaryTypeId, favorite: boolean, today: string): SummariesIndex {
    const current = new Set(loadSettings(this.db).favoriteSummaryTypes)
    if (favorite) current.add(type)
    else current.delete(type)
    updateSettings(this.db, { favoriteSummaryTypes: SUMMARY_TYPE_IDS.filter((id) => current.has(id)) })
    return this.getIndex(today)
  }

  async ask(topicId: string, fragment: string, question: string, today: string): Promise<ClaudeAnswer> {
    const topic = this.accessibleTopic(topicId, today)
    const text = fragment.trim()
    if (!text) throw new SummaryError('Seleccioná un texto para preguntar.')
    if (text.length > MAX_FRAGMENT_LENGTH) throw new SummaryError('El texto seleccionado es demasiado largo: elegí una parte más corta.')
    if (question.length > MAX_QUESTION_LENGTH) throw new SummaryError('La pregunta es demasiado larga.')
    return { answer: await this.askAbout({ topic, fragment: text, question: question.trim() || DEFAULT_QUESTION }) }
  }

  private unlockedTopics(today: string): SummaryTopicOption[] {
    const state = this.progression.getState(today)
    if (!state.placementDone) return []
    const progress = this.progression.getTopicProgress()
    const currentId = state.week?.topicId ?? null
    return this.curriculum.flatMap((topic): SummaryTopicOption[] => {
      const stored = progress.get(topic.id)?.status
      const status = topic.id === currentId ? 'current' : stored === 'passed' || stored === 'review' ? stored : null
      return status ? [{ id: topic.id, title: topic.title, level: topic.level, status }] : []
    })
  }

  private accessibleTopic(topicId: string, today: string): CurriculumTopic {
    const topic = this.topics.get(topicId)
    if (!topic) throw new SummaryError('Ese tópico no existe.')
    if (!this.unlockedTopics(today).some((t) => t.id === topicId)) throw new SummaryError('Todavía no llegaste a este tópico.')
    return topic
  }

  private typeViews(): SummaryTypeView[] {
    const favorites = new Set(loadSettings(this.db).favoriteSummaryTypes)
    const ratings = new Map(
      (
        this.db.prepare('SELECT type, AVG(user_rating) AS rating FROM summaries WHERE user_rating IS NOT NULL GROUP BY type').all() as unknown as {
          type: SummaryTypeId
          rating: number
        }[]
      ).map((r) => [r.type, r.rating])
    )

    // La explicación completa siempre primero; después favoritos, mejor calificados y el orden por defecto.
    const rank = (id: SummaryTypeId): [number, number, number, number] => [
      id === BASE_SUMMARY_TYPE ? 0 : 1,
      favorites.has(id) ? 0 : 1,
      -(ratings.get(id) ?? NEUTRAL_RATING),
      SUMMARY_TYPE_IDS.indexOf(id)
    ]
    const compare = (a: SummaryTypeId, b: SummaryTypeId): number => {
      const [ra, rb] = [rank(a), rank(b)]
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
      return 0
    }

    return [...SUMMARY_TYPE_IDS].sort(compare).map((id) => {
      const averageRating = ratings.get(id) ?? null
      return {
        id,
        ...SUMMARY_TYPES[id],
        favorite: favorites.has(id),
        recommended: averageRating !== null && averageRating >= RECOMMENDED_RATING,
        averageRating: averageRating === null ? null : Math.round(averageRating * 10) / 10
      }
    })
  }

  private view(topic: CurriculumTopic, type: SummaryTypeId): SummaryView {
    const row = this.row(topic.id, type)
    const isBase = type === BASE_SUMMARY_TYPE
    const generatedTypes = (
      this.db.prepare("SELECT type FROM summaries WHERE topic_id = ? AND source = 'ai'").all(topic.id) as unknown as { type: SummaryTypeId }[]
    ).map((r) => r.type)

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      level: topic.level,
      type,
      content: isBase ? { format: 'markdown', markdown: topic.summary } : row ? (JSON.parse(row.content) as SummaryContent) : null,
      source: isBase ? 'base' : row ? 'ai' : null,
      rating: row?.user_rating ?? null,
      generatedAt: isBase ? null : (row?.created_at ?? null),
      generatedTypes
    }
  }

  private row(topicId: string, type: SummaryTypeId): SummaryRow | undefined {
    return this.db.prepare('SELECT content, source, user_rating, created_at FROM summaries WHERE topic_id = ? AND type = ?').get(topicId, type) as
      | SummaryRow
      | undefined
  }
}
