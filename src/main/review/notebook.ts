// Cuaderno de errores. Cada respuesta incorrecta de la práctica o de un examen se guarda como tarjeta
// con su ejercicio y vuelve según FSRS: pronto mientras cuesta y cada vez más espaciada al acertarla.

import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import { addDays } from '../../shared/dates'
import type { ExerciseAnswer, ExerciseFeedback, ExerciseType, OpenExercise, StoredExercise } from '../../shared/exercises'
import type { MistakeSource, ReviewAnswerResult, ReviewItemView, ReviewOverview } from '../../shared/review'
import type { Db } from '../db/database'
import type { OpenAnswerGrader } from '../practice/ai-grading'
import { toPublicExercise } from '../practice/exercises'
import { gradeAuto } from '../practice/grading'
import { addCard, countCards, dueCards, getCard, isLearned, LEARNED_STABILITY, recallFrom, reviewCard, strength, type CardRow } from './cards'

export class NotebookError extends Error {}

// Un texto largo no se repasa reescribiéndolo entero: queda en la corrección del día.
const NOT_REVIEWED: ExerciseType[] = ['writing']
const DUE_LIMIT = 12

export interface NewMistake {
  source: MistakeSource
  sourceId: number
  index?: number
  topicId: string
  subtopicId: string
  exercise: StoredExercise
  given: ExerciseAnswer | null
}

// Se llama al corregir: si ya estaba anotado (el mismo ejercicio), no se repite.
export function recordMistake(db: Db, mistake: NewMistake, today: string): void {
  if (NOT_REVIEWED.includes(mistake.exercise.type)) return
  addCard(
    db,
    {
      kind: 'mistake',
      source: mistake.source,
      sourceKey: `${mistake.sourceId}:${mistake.index ?? 0}`,
      topicId: mistake.topicId,
      subtopicId: mistake.subtopicId,
      payload: mistake.exercise,
      given: mistake.given
    },
    today
  )
}

export class Notebook {
  private readonly topics: Map<string, CurriculumTopic>

  constructor(
    private readonly db: Db,
    curriculum: CurriculumTopic[],
    private readonly gradeOpen: OpenAnswerGrader
  ) {
    this.topics = new Map(curriculum.map((t) => [t.id, t]))
  }

  overview(today: string): ReviewOverview {
    const pendingWhere = `NOT (state = 2 AND stability >= ${LEARNED_STABILITY})`
    const upcoming = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i + 1)
      return { date, count: countCards(this.db, ['mistake'], 'due_on = ?', date) }
    })
    const byTopic = (
      this.db
        .prepare(`SELECT topic_id, COUNT(*) AS n FROM cards WHERE kind = 'mistake' AND ${pendingWhere} GROUP BY topic_id ORDER BY n DESC`)
        .all() as unknown as { topic_id: string; n: number }[]
    ).map((r) => ({ topicId: r.topic_id, topicTitle: this.topics.get(r.topic_id)?.title ?? r.topic_id, pending: r.n }))

    return {
      dueToday: countCards(this.db, ['mistake'], 'due_on <= ?', today),
      pending: countCards(this.db, ['mistake'], pendingWhere),
      learned: countCards(this.db, ['mistake'], `state = 2 AND stability >= ${LEARNED_STABILITY}`),
      upcoming,
      byTopic
    }
  }

  // Lo que toca repasar hoy, lo más atrasado primero.
  due(today: string): ReviewItemView[] {
    return dueCards(this.db, ['mistake'], today, DUE_LIMIT).map((r) => this.view(r))
  }

  // Repaso de un examen: todas las preguntas que se fallaron en él, vengan o no del día.
  fromExam(examId: number): ReviewItemView[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM cards WHERE kind = 'mistake' AND source = 'exam' AND source_key LIKE ? ORDER BY CAST(substr(source_key, instr(source_key, ':') + 1) AS INTEGER)"
      )
      .all(`${examId}:%`) as unknown as CardRow[]
    return rows.filter((r) => !isLearned(r)).map((r) => this.view(r))
  }

  async answer(id: number, answer: ExerciseAnswer, today: string): Promise<ReviewAnswerResult> {
    const row = this.row(id)
    const exercise = JSON.parse(row.payload!) as StoredExercise
    if (exercise.type !== answer.type) throw new NotebookError('La respuesta no corresponde a este ejercicio.')

    const feedback = await this.grade(row, exercise, answer)
    const outcome = reviewCard(this.db, id, recallFrom(feedback.correct, feedback.score), today)
    return { feedback, stage: strength(outcome.card), learned: outcome.learned, nextDue: outcome.dueOn }
  }

  private async grade(row: CardRow, exercise: StoredExercise, answer: ExerciseAnswer): Promise<ExerciseFeedback> {
    const auto = gradeAuto(exercise, answer)
    if (auto.kind === 'graded') return auto.feedback
    const { topic, subtopic } = this.content(row)
    const answers = 'text' in answer ? [answer.text] : 'texts' in answer ? answer.texts : []
    return this.gradeOpen({ topic, subtopic, exercise: exercise as OpenExercise, answers })
  }

  private view(row: CardRow): ReviewItemView {
    const exercise = JSON.parse(row.payload!) as StoredExercise
    const topic = this.topics.get(row.topic_id ?? '')
    return {
      id: row.id,
      type: exercise.type,
      content: toPublicExercise(exercise),
      topicTitle: topic?.title ?? row.topic_id ?? '',
      subtopicTitle: topic?.subtopics.find((s) => s.id === row.subtopic_id)?.title ?? '',
      stage: strength(row),
      source: row.source as MistakeSource,
      given: row.given ? (JSON.parse(row.given) as ExerciseAnswer) : null,
      dueOn: row.due_on
    }
  }

  private row(id: number): CardRow {
    const row = getCard(this.db, id)
    if (!row || row.kind !== 'mistake') throw new NotebookError('Ese error no está en el cuaderno.')
    return row
  }

  // Si el temario cambió, se corrige con el primer subtema del tópico (o el primero del curso).
  private content(row: CardRow): { topic: CurriculumTopic; subtopic: Subtopic } {
    const topic = this.topics.get(row.topic_id ?? '') ?? [...this.topics.values()][0]
    const subtopic = topic.subtopics.find((s) => s.id === row.subtopic_id) ?? topic.subtopics[0]
    return { topic, subtopic }
  }
}
