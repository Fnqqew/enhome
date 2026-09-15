// Pruebas: examen semanal (con una única pausa de 30 minutos si se interrumpe) y simulacros.

import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import {
  EXAM_INTERRUPTED_MESSAGE,
  type ExamBreakdownItem,
  type ExamEndReason,
  type ExamHistoryItem,
  type ExamKind,
  type ExamOutcomeView,
  type ExamQuestion,
  type ExamQuestionView,
  type ExamResultView,
  type ExamSessionView,
  type MockScope,
  type ResumeResult,
  type TestsOverview
} from '../../shared/exams'
import type { ExerciseAnswer, ExerciseFeedback, OpenExercise, StoredExercise } from '../../shared/exercises'
import { transaction, type Db } from '../db/database'
import type { AnswerTag } from '../engine/planning'
import type { Progression } from '../engine/progression'
import type { OpenAnswerGrader } from '../practice/ai-grading'
import { toPublicExercise } from '../practice/exercises'
import { gradeAuto } from '../practice/grading'
import { secondChanceFor } from '../rewards/inventory'
import type { ExamGenerator, ExamRequest } from './generation'
import { planMockExam, planWeeklyExam, type ExamItemPlan } from './plan'
import { HEARTBEAT_TIMEOUT_MS, PAUSE_LIMIT_MS, WEAK_SUBTOPIC_RATE } from './rules'

export class ExamError extends Error {}

const HISTORY_LIMIT = 30

interface ExamRow {
  id: number
  kind: ExamKind
  scope: MockScope | null
  topic_id: string | null
  week_id: number | null
  status: 'in_progress' | 'paused' | 'submitted' | 'voided'
  questions: string
  grade: number | null
  passed: number | null
  pause_used: number
  paused_at: string | null
  last_seen_at: string | null
  end_reason: ExamEndReason | null
  started_on: string | null
  submitted_at: string | null
}

interface AnswerRow {
  question_index: number
  answer: string | null
  feedback: string | null
}

// Respuesta vacía para corregir una pregunta sin responder (siempre queda incorrecta, sin usar IA).
function emptyAnswer(exercise: StoredExercise): ExerciseAnswer {
  switch (exercise.type) {
    case 'multiple_choice':
      return { type: exercise.type, choice: -1 }
    case 'reading':
      return { type: exercise.type, choices: [] }
    case 'word_order':
      return { type: exercise.type, tokens: [] }
    default:
      return { type: exercise.type, text: '' }
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10

export class Exams {
  private readonly drafting = new Map<number, Promise<void>>()
  private readonly finalizing = new Map<number, Promise<ExamResultView>>()
  private readonly topics: Map<string, CurriculumTopic>

  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly generateExam: ExamGenerator,
    private readonly gradeOpen: OpenAnswerGrader,
    private readonly now: () => number = Date.now
  ) {
    this.topics = new Map(curriculum.map((t) => [t.id, t]))
  }

  // Un examen semanal en curso o en pausa bloquea la navegación.
  hasBlockingExam(): boolean {
    return this.db.prepare("SELECT 1 FROM exams WHERE kind = 'weekly' AND status IN ('in_progress', 'paused')").get() !== undefined
  }

  async getOverview(today: string): Promise<TestsOverview> {
    const notice = await this.resolveInterruptions(today)
    const state = this.progression.getState(today)
    const open = this.openExam()
    const week = state.week

    let exam: TestsOverview['exam'] = null
    if (open?.status === 'in_progress') exam = { state: 'active', session: this.sessionView(open) }
    else if (open?.status === 'paused') exam = { state: 'paused', examId: open.id, kind: open.kind, title: this.title(open), minutesLeft: this.minutesLeft(open) }

    const available = week?.examStatus === 'available'
    const ready = week ? this.hasDraft(week.id) : false
    if (week && available && !ready && !open) this.prepareDraft(week.topicId, week.id).catch(() => undefined)

    const unlocked = this.unlockedTopics(today)
    const mockTopic = (week ? this.topics.get(week.topicId) : undefined) ?? unlocked[unlocked.length - 1]

    return {
      exam,
      notice,
      weekly: {
        available,
        message: week
          ? week.examMessage
          : !state.placementDone
            ? 'Primero hacé el examen inicial desde Inicio.'
            : state.finished
              ? 'Completaste todo el temario disponible.'
              : 'Todavía no hay una semana activa.',
        topicTitle: week?.topicTitle ?? null,
        preparing: week ? this.drafting.has(week.id) : false,
        ready
      },
      mock: {
        available: unlocked.length > 0 && !open,
        reason: !state.placementDone
          ? 'Primero hacé el examen inicial desde Inicio.'
          : open
            ? 'Terminá la prueba en curso para empezar un simulacro.'
            : unlocked.length === 0
              ? 'Todavía no hay tópicos para practicar.'
              : null,
        topicTitle: mockTopic?.title ?? null
      },
      history: this.history()
    }
  }

  async startWeekly(today: string): Promise<ExamSessionView> {
    await this.resolveInterruptions(today)
    if (this.openExam()) throw new ExamError('Ya hay una prueba en curso.')
    const week = this.progression.getState(today).week
    if (!week || week.examStatus !== 'available') throw new ExamError(week?.examMessage ?? 'No hay un examen disponible.')

    if (!this.hasDraft(week.id)) await this.prepareDraft(week.topicId, week.id)
    if (this.openExam()) throw new ExamError('Ya hay una prueba en curso.')

    const draft = this.db.prepare('SELECT questions FROM exam_drafts WHERE week_id = ?').get(week.id) as { questions: string }
    const examId = transaction(this.db, () => {
      const { lastInsertRowid } = this.db
        .prepare(
          "INSERT INTO exams (kind, topic_id, week_id, status, questions, started_on, last_seen_at) VALUES ('weekly', ?, ?, 'in_progress', ?, ?, ?)"
        )
        .run(week.topicId, week.id, draft.questions, today, this.nowIso())
      // Las preguntas se usan una sola vez: si el examen se anula, el próximo tiene otras.
      this.db.prepare('DELETE FROM exam_drafts WHERE week_id = ?').run(week.id)
      return Number(lastInsertRowid)
    })
    return this.sessionView(this.exam(examId))
  }

  async startMock(scope: MockScope, today: string): Promise<ExamSessionView> {
    await this.resolveInterruptions(today)
    if (this.openExam()) throw new ExamError('Ya hay una prueba en curso.')
    const unlocked = this.unlockedTopics(today)
    if (unlocked.length === 0) throw new ExamError('Todavía no hay tópicos para practicar.')

    const week = this.progression.getState(today).week
    const topics = scope === 'topic' ? [(week ? this.topics.get(week.topicId) : undefined) ?? unlocked[unlocked.length - 1]] : unlocked
    const questions = await this.generateExam(this.request('mock', planMockExam(topics), []))
    if (this.openExam()) throw new ExamError('Ya hay una prueba en curso.')

    const { lastInsertRowid } = this.db
      .prepare("INSERT INTO exams (kind, scope, topic_id, status, questions, started_on, last_seen_at) VALUES ('mock', ?, ?, 'in_progress', ?, ?, ?)")
      .run(scope, scope === 'topic' ? topics[0].id : null, JSON.stringify(questions), today, this.nowIso())
    return this.sessionView(this.exam(Number(lastInsertRowid)))
  }

  saveAnswer(examId: number, index: number, answer: ExerciseAnswer | null): void {
    const row = this.requireInProgress(examId)
    this.assertNotInterrupted(row)
    const question = this.questions(row)[index]
    if (!question) throw new ExamError('Esa pregunta no existe.')
    if (answer && answer.type !== question.exercise.type) throw new ExamError('La respuesta no corresponde a esta pregunta.')

    if (answer) {
      this.db
        .prepare(
          `INSERT INTO exam_answers (exam_id, question_index, answer, topic_tag, subtopic_tag) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (exam_id, question_index) DO UPDATE SET answer = excluded.answer`
        )
        .run(examId, index, JSON.stringify(answer), question.topicId, question.subtopicId)
    } else {
      this.db.prepare('DELETE FROM exam_answers WHERE exam_id = ? AND question_index = ?').run(examId, index)
    }
    this.touch(examId)
  }

  heartbeat(examId: number): void {
    const row = this.requireInProgress(examId)
    this.assertNotInterrupted(row)
    this.touch(examId)
  }

  async resume(examId: number, today: string): Promise<ResumeResult> {
    await this.resolveInterruptions(today)
    const row = this.exam(examId)
    if (row.status === 'paused') {
      this.db.prepare("UPDATE exams SET status = 'in_progress', pause_used = 1, paused_at = NULL, last_seen_at = ? WHERE id = ?").run(this.nowIso(), examId)
      return { state: 'active', session: this.sessionView(this.exam(examId)) }
    }
    if (row.status === 'in_progress') {
      this.touch(examId)
      return { state: 'active', session: this.sessionView(row) }
    }
    if (row.status === 'submitted') return { state: 'result', result: this.resultView(row, null) }
    return { state: 'voided', message: this.voidedMessage(row) }
  }

  submit(examId: number, today: string): Promise<ExamResultView> {
    return this.finalize(this.requireInProgress(examId), today, null)
  }

  getResult(examId: number): ExamResultView {
    const row = this.exam(examId)
    if (row.status !== 'submitted') throw new ExamError('Esa prueba no tiene resultado.')
    return this.resultView(row, null)
  }

  discardMock(examId: number): void {
    const row = this.requireInProgress(examId)
    if (row.kind !== 'mock') throw new ExamError('Solo se pueden descartar simulacros.')
    this.db.prepare("UPDATE exams SET status = 'voided', submitted_at = datetime('now') WHERE id = ?").run(examId)
  }

  // Detecta exámenes semanales interrumpidos: los pausa, los anula si la pausa venció,
  // o los entrega si es la segunda interrupción.
  private async resolveInterruptions(today: string): Promise<string | null> {
    const rows = this.db.prepare("SELECT * FROM exams WHERE kind = 'weekly' AND status IN ('in_progress', 'paused')").all() as unknown as ExamRow[]
    let notice: string | null = null

    for (const row of rows) {
      if (row.status === 'in_progress' && this.isStale(row)) {
        if (row.pause_used) {
          await this.finalize(row, today, 'second-interruption')
          notice = 'Tu examen se entregó automáticamente con las respuestas que tenías, porque se interrumpió por segunda vez.'
          continue
        }
        this.db.prepare("UPDATE exams SET status = 'paused', paused_at = last_seen_at WHERE id = ?").run(row.id)
        row.status = 'paused'
        row.paused_at = row.last_seen_at
      }
      if (row.status === 'paused' && this.pauseElapsed(row) > PAUSE_LIMIT_MS) {
        this.db.prepare("UPDATE exams SET status = 'voided', end_reason = 'pause-expired', submitted_at = datetime('now') WHERE id = ?").run(row.id)
        notice = this.voidedMessage({ ...row, end_reason: 'pause-expired' })
      }
    }
    return notice
  }

  private finalize(row: ExamRow, today: string, endReason: ExamEndReason | null): Promise<ExamResultView> {
    let pending = this.finalizing.get(row.id)
    if (!pending) {
      pending = this.grade(row, today, endReason).finally(() => this.finalizing.delete(row.id))
      this.finalizing.set(row.id, pending)
    }
    return pending
  }

  private async grade(row: ExamRow, today: string, endReason: ExamEndReason | null): Promise<ExamResultView> {
    const questions = this.questions(row)
    const saved = this.answerRows(row.id)

    const graded = await Promise.all(
      questions.map(async (question, i): Promise<{ answer: ExerciseAnswer | null; feedback: ExerciseFeedback }> => {
        const stored = saved.get(i)?.answer
        const answer = stored ? (JSON.parse(stored) as ExerciseAnswer) : null
        const auto = gradeAuto(question.exercise, answer ?? emptyAnswer(question.exercise))
        if (auto.kind === 'graded') return { answer, feedback: auto.feedback }
        const { topic, subtopic } = this.content(question.topicId, question.subtopicId)
        const text = answer && 'text' in answer ? answer.text : ''
        return { answer, feedback: await this.gradeOpen({ topic, subtopic, exercise: question.exercise as OpenExercise, answer: text }) }
      })
    )

    // Si mientras se corregía el examen cambió de estado, no se vuelve a registrar.
    const current = this.exam(row.id)
    if (current.status === 'submitted') return this.resultView(current, null)
    if (current.status === 'voided') throw new ExamError(this.voidedMessage(current))

    const grade = round1(graded.reduce((sum, g) => sum + g.feedback.score, 0) / Math.max(graded.length, 1))
    const tags: AnswerTag[] = questions.map((q, i) => ({ topicId: q.topicId, subtopicId: q.subtopicId, correct: graded[i].feedback.correct }))

    transaction(this.db, () => {
      const upsert = this.db.prepare(
        `INSERT INTO exam_answers (exam_id, question_index, answer, correct, score, feedback, topic_tag, subtopic_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (exam_id, question_index) DO UPDATE SET correct = excluded.correct, score = excluded.score, feedback = excluded.feedback`
      )
      questions.forEach((q, i) => {
        const { answer, feedback } = graded[i]
        upsert.run(row.id, i, answer ? JSON.stringify(answer) : null, feedback.correct ? 1 : 0, feedback.score, JSON.stringify(feedback), q.topicId, q.subtopicId)
      })
      this.db.prepare('UPDATE exams SET end_reason = ? WHERE id = ?').run(endReason, row.id)
    })

    const titles = (ids: string[]): string[] => ids.map((id) => this.topics.get(id)?.title ?? id)

    if (row.kind === 'weekly') {
      try {
        const outcome = this.progression.submitWeeklyExam({ grade, answers: tags }, today, { examId: row.id, startedOn: row.started_on ?? today })
        return this.resultView(this.exam(row.id), {
          nextWeekStart: outcome.nextWeekStart,
          finished: outcome.finished,
          retry: !outcome.passed,
          weakTopics: titles(outcome.weakTopics)
        })
      } catch (err) {
        this.db.prepare("UPDATE exams SET status = 'voided', end_reason = 'week-closed', submitted_at = datetime('now') WHERE id = ?").run(row.id)
        throw new ExamError(`No se pudo registrar el examen: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    this.db.prepare("UPDATE exams SET status = 'submitted', grade = ?, submitted_at = datetime('now') WHERE id = ?").run(grade, row.id)
    const weak = this.progression.applyMockResult(tags, today)
    return this.resultView(this.exam(row.id), { nextWeekStart: null, finished: false, retry: false, weakTopics: titles(weak) })
  }

  private prepareDraft(topicId: string, weekId: number): Promise<void> {
    let pending = this.drafting.get(weekId)
    if (!pending) {
      const topic = this.topic(topicId)
      const weakness = this.subtopicWeakness(topic.id)
      const plan = planWeeklyExam(topic, this.reviewTopicsFor(topic), weakness)
      const notes = topic.subtopics.flatMap((s) => {
        const rate = weakness.get(s.id) ?? 0
        return rate > WEAK_SUBTOPIC_RATE
          ? [`En la práctica falló más en «${s.title}» (${Math.round(rate * 100)} % de errores): incluí preguntas un poco más exigentes sobre eso.`]
          : []
      })
      pending = this.generateExam(this.request('weekly', plan, notes))
        .then((questions) => {
          this.db
            .prepare(
              `INSERT INTO exam_drafts (week_id, questions) VALUES (?, ?)
               ON CONFLICT (week_id) DO UPDATE SET questions = excluded.questions, created_at = datetime('now')`
            )
            .run(weekId, JSON.stringify(questions))
        })
        .catch((err) => {
          console.error('[exams] No se pudo preparar el examen semanal', err)
          throw err
        })
        .finally(() => this.drafting.delete(weekId))
      this.drafting.set(weekId, pending)
    }
    return pending
  }

  private request(kind: ExamKind, plan: ExamItemPlan[], focusNotes: string[]): ExamRequest {
    const items = plan.map((p) => ({ ...this.content(p.topicId, p.subtopicId), type: p.type }))
    const levels = items.map((i) => i.topic.level).sort()
    return { kind, level: levels[levels.length - 1], items, focusNotes }
  }

  // Prerrequisitos del tópico o, si no tiene, el tópico anterior del temario.
  private reviewTopicsFor(topic: CurriculumTopic): CurriculumTopic[] {
    const prerequisites = topic.prerequisites.flatMap((id) => this.topics.get(id) ?? [])
    if (prerequisites.length > 0) return prerequisites
    const index = this.curriculum.findIndex((t) => t.id === topic.id)
    return index > 0 ? [this.curriculum[index - 1]] : []
  }

  private subtopicWeakness(topicId: string): Map<string, number> {
    const rows = this.db
      .prepare(
        `SELECT e.subtopic_id AS id, AVG(CASE WHEN a.correct = 1 THEN 0.0 ELSE 1.0 END) AS rate
         FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id WHERE e.topic_id = ? GROUP BY e.subtopic_id`
      )
      .all(topicId) as unknown as { id: string; rate: number }[]
    return new Map(rows.map((r) => [r.id, r.rate]))
  }

  private unlockedTopics(today: string): CurriculumTopic[] {
    const state = this.progression.getState(today)
    if (!state.placementDone) return []
    const progress = this.progression.getTopicProgress()
    const currentId = state.week?.topicId
    return this.curriculum.filter((t) => {
      const status = progress.get(t.id)?.status
      return t.id === currentId || status === 'passed' || status === 'review'
    })
  }

  private sessionView(row: ExamRow): ExamSessionView {
    return {
      id: row.id,
      kind: row.kind,
      scope: row.scope,
      title: this.title(row),
      questions: this.questionViews(row),
      pauseUsed: row.pause_used === 1,
      secondChance: secondChanceFor(this.db, row.id)
    }
  }

  private resultView(row: ExamRow, outcome: ExamOutcomeView | null): ExamResultView {
    const questions = this.questionViews(row)
    const breakdown = new Map<string, ExamBreakdownItem>()
    for (const q of questions) {
      const key = `${q.topicTitle}/${q.subtopicTitle}`
      const item = breakdown.get(key) ?? { topicTitle: q.topicTitle, subtopicTitle: q.subtopicTitle, correct: 0, total: 0 }
      item.total++
      if (q.feedback?.correct) item.correct++
      breakdown.set(key, item)
    }
    return {
      id: row.id,
      kind: row.kind,
      scope: row.scope,
      title: this.title(row),
      grade: row.grade ?? 0,
      passed: row.kind === 'weekly' ? row.passed === 1 : null,
      endReason: row.end_reason,
      questions,
      breakdown: [...breakdown.values()],
      outcome
    }
  }

  private questionViews(row: ExamRow): ExamQuestionView[] {
    const answers = this.answerRows(row.id)
    return this.questions(row).map((q, index) => {
      const saved = answers.get(index)
      const topic = this.topics.get(q.topicId)
      return {
        index,
        type: q.exercise.type,
        topicTitle: topic?.title ?? q.topicId,
        subtopicTitle: topic?.subtopics.find((s) => s.id === q.subtopicId)?.title ?? q.subtopicId,
        content: toPublicExercise(q.exercise),
        answer: saved?.answer ? (JSON.parse(saved.answer) as ExerciseAnswer) : null,
        feedback: saved?.feedback ? (JSON.parse(saved.feedback) as ExerciseFeedback) : null
      }
    })
  }

  private history(): ExamHistoryItem[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM exams WHERE kind IN ('weekly', 'mock') AND status IN ('submitted', 'voided') ORDER BY id DESC LIMIT ?"
      )
      .all(HISTORY_LIMIT) as unknown as ExamRow[]
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: this.title(row),
      date: row.started_on ?? row.submitted_at?.slice(0, 10) ?? '',
      grade: row.grade,
      passed: row.kind === 'weekly' && row.status === 'submitted' ? row.passed === 1 : null,
      status: row.status as 'submitted' | 'voided',
      endReason: row.end_reason
    }))
  }

  private title(row: ExamRow): string {
    const topic = row.topic_id ? this.topics.get(row.topic_id)?.title : null
    if (row.kind === 'weekly') return `Examen semanal · ${topic ?? 'tópico'}`
    return row.scope === 'topic' && topic ? `Simulacro · ${topic}` : 'Simulacro general'
  }

  private voidedMessage(row: ExamRow): string {
    if (row.end_reason === 'pause-expired') {
      return 'Tu examen se anuló porque pasaron más de 30 minutos desde que se interrumpió. No cuenta como reprobado: podés rendir uno nuevo con otras preguntas.'
    }
    if (row.end_reason === 'week-closed') return 'El examen no se pudo registrar porque la semana ya estaba cerrada.'
    return 'Esta prueba se anuló.'
  }

  private assertNotInterrupted(row: ExamRow): void {
    if (row.kind === 'weekly' && this.isStale(row)) throw new ExamError(EXAM_INTERRUPTED_MESSAGE)
  }

  private isStale(row: ExamRow): boolean {
    return row.last_seen_at !== null && this.now() - Date.parse(row.last_seen_at) > HEARTBEAT_TIMEOUT_MS
  }

  private pauseElapsed(row: ExamRow): number {
    return row.paused_at ? this.now() - Date.parse(row.paused_at) : 0
  }

  private minutesLeft(row: ExamRow): number {
    return Math.max(0, Math.ceil((PAUSE_LIMIT_MS - this.pauseElapsed(row)) / 60_000))
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString()
  }

  private touch(examId: number): void {
    this.db.prepare('UPDATE exams SET last_seen_at = ? WHERE id = ?').run(this.nowIso(), examId)
  }

  private hasDraft(weekId: number): boolean {
    return this.db.prepare('SELECT 1 FROM exam_drafts WHERE week_id = ?').get(weekId) !== undefined
  }

  private openExam(): ExamRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM exams WHERE kind IN ('weekly', 'mock') AND status IN ('in_progress', 'paused') ORDER BY id DESC LIMIT 1")
        .get() as ExamRow | undefined) ?? null
    )
  }

  private exam(examId: number): ExamRow {
    const row = this.db.prepare("SELECT * FROM exams WHERE id = ? AND kind IN ('weekly', 'mock')").get(examId) as ExamRow | undefined
    if (!row) throw new ExamError('Esa prueba no existe.')
    return row
  }

  private requireInProgress(examId: number): ExamRow {
    const row = this.exam(examId)
    if (row.status !== 'in_progress') throw new ExamError(row.status === 'paused' ? EXAM_INTERRUPTED_MESSAGE : 'Esa prueba ya terminó.')
    return row
  }

  private questions(row: ExamRow): ExamQuestion[] {
    return JSON.parse(row.questions) as ExamQuestion[]
  }

  private answerRows(examId: number): Map<number, AnswerRow> {
    const rows = this.db.prepare('SELECT question_index, answer, feedback FROM exam_answers WHERE exam_id = ?').all(examId) as unknown as AnswerRow[]
    return new Map(rows.map((r) => [r.question_index, r]))
  }

  private topic(topicId: string): CurriculumTopic {
    const topic = this.topics.get(topicId)
    if (!topic) throw new ExamError(`El tópico ${topicId} ya no existe en el temario.`)
    return topic
  }

  private content(topicId: string, subtopicId: string): { topic: CurriculumTopic; subtopic: Subtopic } {
    const topic = this.topic(topicId)
    const subtopic = topic.subtopics.find((s) => s.id === subtopicId)
    if (!subtopic) throw new ExamError(`El subtema ${topicId}/${subtopicId} ya no existe en el temario.`)
    return { topic, subtopic }
  }
}
