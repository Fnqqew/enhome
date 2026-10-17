// Cuaderno de errores con repaso espaciado. Cada respuesta incorrecta de la práctica o de un examen
// se guarda con su ejercicio y vuelve a los 1, 3, 7 y 15 días; si se falla, vuelve a empezar.

import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import { addDays } from '../../shared/dates'
import type { ExerciseAnswer, ExerciseFeedback, ExerciseType, OpenExercise, StoredExercise } from '../../shared/exercises'
import {
  REVIEW_INTERVALS,
  REVIEW_STEPS,
  type MistakeSource,
  type ReviewAnswerResult,
  type ReviewItemView,
  type ReviewOverview
} from '../../shared/review'
import type { Db } from '../db/database'
import type { OpenAnswerGrader } from '../practice/ai-grading'
import { toPublicExercise } from '../practice/exercises'
import { gradeAuto } from '../practice/grading'

export class NotebookError extends Error {}

// Un texto largo no se repasa reescribiéndolo entero: queda en la corrección del día.
const NOT_REVIEWED: ExerciseType[] = ['writing']
const DUE_LIMIT = 12

interface MistakeRow {
  id: number
  source: MistakeSource
  source_id: number
  topic_id: string
  subtopic_id: string
  payload: string
  given: string | null
  stage: number
  due_on: string
  resolved_on: string | null
}

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
  db.prepare(
    `INSERT OR IGNORE INTO mistakes (source, source_id, item_index, topic_id, subtopic_id, payload, given, due_on, created_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    mistake.source,
    mistake.sourceId,
    mistake.index ?? 0,
    mistake.topicId,
    mistake.subtopicId,
    JSON.stringify(mistake.exercise),
    mistake.given ? JSON.stringify(mistake.given) : null,
    addDays(today, REVIEW_INTERVALS[0]),
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
    const count = (sql: string, ...args: (string | number)[]): number => (this.db.prepare(sql).get(...args) as { n: number }).n
    const upcoming = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i + 1)
      return { date, count: count('SELECT COUNT(*) AS n FROM mistakes WHERE resolved_on IS NULL AND due_on = ?', date) }
    })
    const byTopic = (
      this.db
        .prepare('SELECT topic_id, COUNT(*) AS n FROM mistakes WHERE resolved_on IS NULL GROUP BY topic_id ORDER BY n DESC')
        .all() as unknown as { topic_id: string; n: number }[]
    ).map((r) => ({ topicId: r.topic_id, topicTitle: this.topics.get(r.topic_id)?.title ?? r.topic_id, pending: r.n }))

    return {
      dueToday: count('SELECT COUNT(*) AS n FROM mistakes WHERE resolved_on IS NULL AND due_on <= ?', today),
      pending: count('SELECT COUNT(*) AS n FROM mistakes WHERE resolved_on IS NULL'),
      learned: count('SELECT COUNT(*) AS n FROM mistakes WHERE resolved_on IS NOT NULL'),
      upcoming,
      byTopic
    }
  }

  // Lo que toca repasar hoy, lo más atrasado primero.
  due(today: string): ReviewItemView[] {
    const rows = this.db
      .prepare('SELECT * FROM mistakes WHERE resolved_on IS NULL AND due_on <= ? ORDER BY due_on, id LIMIT ?')
      .all(today, DUE_LIMIT) as unknown as MistakeRow[]
    return rows.map((r) => this.view(r))
  }

  // Repaso de un examen: todas las preguntas que se fallaron en él, vengan o no del día.
  fromExam(examId: number): ReviewItemView[] {
    const rows = this.db
      .prepare("SELECT * FROM mistakes WHERE source = 'exam' AND source_id = ? AND resolved_on IS NULL ORDER BY item_index")
      .all(examId) as unknown as MistakeRow[]
    return rows.map((r) => this.view(r))
  }

  async answer(id: number, answer: ExerciseAnswer, today: string): Promise<ReviewAnswerResult> {
    const row = this.row(id)
    if (row.resolved_on) throw new NotebookError('Ese error ya está aprendido.')
    const exercise = JSON.parse(row.payload) as StoredExercise
    if (exercise.type !== answer.type) throw new NotebookError('La respuesta no corresponde a este ejercicio.')

    const feedback = await this.grade(row, exercise, answer)
    const stage = feedback.correct ? row.stage + 1 : 0
    const learned = stage >= REVIEW_STEPS
    const nextDue = learned ? null : addDays(today, REVIEW_INTERVALS[stage])
    this.db
      .prepare('UPDATE mistakes SET stage = ?, due_on = COALESCE(?, due_on), resolved_on = ?, reviews = reviews + 1 WHERE id = ?')
      .run(stage, nextDue, learned ? today : null, id)
    return { feedback, stage, learned, nextDue }
  }

  private async grade(row: MistakeRow, exercise: StoredExercise, answer: ExerciseAnswer): Promise<ExerciseFeedback> {
    const auto = gradeAuto(exercise, answer)
    if (auto.kind === 'graded') return auto.feedback
    const { topic, subtopic } = this.content(row)
    const answers = 'text' in answer ? [answer.text] : 'texts' in answer ? answer.texts : []
    return this.gradeOpen({ topic, subtopic, exercise: exercise as OpenExercise, answers })
  }

  private view(row: MistakeRow): ReviewItemView {
    const exercise = JSON.parse(row.payload) as StoredExercise
    const topic = this.topics.get(row.topic_id)
    return {
      id: row.id,
      type: exercise.type,
      content: toPublicExercise(exercise),
      topicTitle: topic?.title ?? row.topic_id,
      subtopicTitle: topic?.subtopics.find((s) => s.id === row.subtopic_id)?.title ?? '',
      stage: row.stage,
      source: row.source,
      given: row.given ? (JSON.parse(row.given) as ExerciseAnswer) : null,
      dueOn: row.due_on
    }
  }

  private row(id: number): MistakeRow {
    const row = this.db.prepare('SELECT * FROM mistakes WHERE id = ?').get(id) as MistakeRow | undefined
    if (!row) throw new NotebookError('Ese error no está en el cuaderno.')
    return row
  }

  // Si el temario cambió, se corrige con el primer subtema del tópico (o el primero del curso).
  private content(row: MistakeRow): { topic: CurriculumTopic; subtopic: Subtopic } {
    const topic = this.topics.get(row.topic_id) ?? [...this.topics.values()][0]
    const subtopic = topic.subtopics.find((s) => s.id === row.subtopic_id) ?? topic.subtopics[0]
    return { topic, subtopic }
  }
}
