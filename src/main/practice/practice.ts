// Prácticas: arma la sesión del día con ejercicios generados por Claude, corrige y registra el avance.

import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import {
  SKILL_OF_TYPE,
  type ExerciseAnswer,
  type ExerciseFeedback,
  type ExerciseType,
  type OpenExercise,
  type PracticeRating,
  type PracticeResult,
  type PracticeView,
  type SessionView,
  type StoredExercise
} from '../../shared/exercises'
import type { PracticeUnitView, UnitKind } from '../../shared/progress'
import { transaction, type Db } from '../db/database'
import type { Progression } from '../engine/progression'
import type { OpenAnswerGrader } from './ai-grading'
import { composeSession, planPool, type TypePreferences } from './composition'
import { mainText, toPublicExercise } from './exercises'
import type { PoolGenerator } from './generation'
import { gradeAuto } from './grading'

export class PracticeError extends Error {}

const AVOID_RECENT = 20

interface SessionRow {
  id: number
  week_id: number
  unit_id: number | null
  topic_id: string
  subtopic_id: string
  kind: UnitKind
  completed_on: string | null
}

interface ExerciseRow {
  id: number
  type: ExerciseType
  payload: string
  slot: number | null
  skipped: number
  session_id: number | null
}

interface AttemptRow {
  exercise_id: number
  answer: string
  feedback: string
  user_rating: number | null
}

interface Target {
  purpose: 'unit' | 'recovery'
  weekId: number
  unit: PracticeUnitView
}

export class Practice {
  private readonly generating = new Map<number, Promise<void>>()
  private readonly topics: Map<string, CurriculumTopic>

  constructor(
    private readonly db: Db,
    curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly generatePool: PoolGenerator,
    private readonly gradeOpen: OpenAnswerGrader
  ) {
    this.topics = new Map(curriculum.map((t) => [t.id, t]))
  }

  getView(today: string): PracticeView {
    const target = this.target(today)
    if ('reason' in target) return { status: 'unavailable', reason: target.reason }

    const session = this.findSession(target)
    if (session && this.hasSlots(session.id)) return { status: 'session', session: this.sessionView(session) }

    // Mientras el alumno lee la introducción, se preparan los ejercicios.
    this.prefetch(target)
    const { topic, subtopic } = this.content(target.unit.topicId, target.unit.subtopicId)
    return {
      status: 'ready',
      purpose: target.purpose,
      unitIndex: target.purpose === 'unit' ? target.unit.index : null,
      kind: target.unit.kind,
      topicTitle: topic.title,
      subtopicTitle: subtopic.title,
      goal: subtopic.goal,
      keyPoints: subtopic.keyPoints,
      examples: subtopic.examples
    }
  }

  async start(today: string): Promise<PracticeView> {
    const target = this.target(today)
    if ('reason' in target) throw new PracticeError(target.reason)
    const session = this.findSession(target) ?? this.createSession(target)
    await this.ensurePool(session)
    if (!this.hasSlots(session.id)) this.assignSlots(session)
    return { status: 'session', session: this.sessionView(this.session(session.id)) }
  }

  async answer(exerciseId: number, answer: ExerciseAnswer): Promise<PracticeView> {
    const { exercise, session } = this.openExercise(exerciseId)
    if (this.attempt(exerciseId)) throw new PracticeError('Ese ejercicio ya está respondido.')
    const stored = JSON.parse(exercise.payload) as StoredExercise
    if (stored.type !== answer.type) throw new PracticeError('La respuesta no corresponde a este ejercicio.')

    const auto = gradeAuto(stored, answer)
    let feedback: ExerciseFeedback
    if (auto.kind === 'graded') {
      feedback = auto.feedback
    } else {
      const { topic, subtopic } = this.content(session.topic_id, session.subtopic_id)
      feedback = await this.gradeOpen({ topic, subtopic, exercise: stored as OpenExercise, answer: 'text' in answer ? answer.text : '' })
    }

    // Pudo llegar otra respuesta mientras Claude corregía.
    if (this.attempt(exerciseId)) throw new PracticeError('Ese ejercicio ya está respondido.')
    this.db
      .prepare('INSERT INTO exercise_attempts (exercise_id, answer, correct, score, feedback) VALUES (?, ?, ?, ?, ?)')
      .run(exerciseId, JSON.stringify(answer), feedback.correct ? 1 : 0, feedback.score, JSON.stringify(feedback))
    return { status: 'session', session: this.sessionView(session) }
  }

  // Cambia un ejercicio sin responder por una alternativa, priorizando mantener el tipo de habilidad.
  skip(exerciseId: number): PracticeView {
    const { exercise, session } = this.openExercise(exerciseId)
    if (this.attempt(exerciseId)) throw new PracticeError('Ya respondiste ese ejercicio.')

    const spares = this.exerciseRows(session.id).filter((r) => r.slot === null && !r.skipped)
    const sameSkill = (r: ExerciseRow): boolean => SKILL_OF_TYPE[r.type] === SKILL_OF_TYPE[exercise.type]
    const keepsType = exercise.type === 'reading' || exercise.type === 'writing'
    const replacement = keepsType
      ? (spares.find((r) => r.type === exercise.type) ?? spares.find(sameSkill) ?? spares[0])
      : (spares.find((r) => r.type !== exercise.type && sameSkill(r)) ?? spares.find(sameSkill) ?? spares[0])
    if (!replacement) throw new PracticeError('No quedan ejercicios alternativos para esta práctica.')

    transaction(this.db, () => {
      this.db.prepare('UPDATE exercises SET slot = NULL, skipped = 1 WHERE id = ?').run(exercise.id)
      this.db.prepare('UPDATE exercises SET slot = ? WHERE id = ?').run(exercise.slot, replacement.id)
    })
    return { status: 'session', session: this.sessionView(session) }
  }

  rate(exerciseId: number, rating: PracticeRating): PracticeView {
    const { session } = this.openExercise(exerciseId, { allowCompleted: true })
    if (!this.attempt(exerciseId)) throw new PracticeError('Primero respondé el ejercicio.')
    this.db.prepare('UPDATE exercise_attempts SET user_rating = ? WHERE exercise_id = ?').run(rating, exerciseId)
    return { status: 'session', session: this.sessionView(session) }
  }

  finish(sessionId: number, today: string): PracticeResult {
    const session = this.session(sessionId)
    if (session.completed_on) throw new PracticeError('Esta práctica ya está terminada.')
    const view = this.sessionView(session)
    if (!view.canFinish) throw new PracticeError('Todavía quedan ejercicios sin responder.')

    if (session.unit_id !== null) this.progression.completeUnit(session.unit_id, today)
    else this.progression.recordRecoverySession(today)
    this.db.prepare('UPDATE practice_sessions SET completed_on = ? WHERE id = ?').run(today, session.id)
    this.prefetchUpcoming(today)

    const feedbacks = view.exercises.map((e) => e.feedback!)
    return {
      purpose: view.purpose,
      unitIndex: view.unitIndex,
      correct: feedbacks.filter((f) => f.correct).length,
      total: feedbacks.length,
      averageScore: Math.round((feedbacks.reduce((sum, f) => sum + f.score, 0) / feedbacks.length) * 10) / 10
    }
  }

  private target(today: string): Target | { reason: string } {
    const state = this.progression.getState(today)
    if (!state.placementDone) return { reason: 'Primero hacé el examen inicial desde Inicio.' }
    const { week } = state
    if (!week) return { reason: state.finished ? 'Completaste todo el temario disponible.' : 'Todavía no hay una semana activa.' }

    if (week.canPracticeNow && week.nextUnit) return { purpose: 'unit', weekId: week.id, unit: week.nextUnit }
    if (week.canRecover && !week.nextUnit) {
      // Recuperación: repaso del subtema del día que faltó.
      const missed = week.days.find((d) => d.status === 'missed')
      const unit = week.units.find((u) => u.index === missed?.weekday) ?? week.units[0]
      return { purpose: 'recovery', weekId: week.id, unit: { ...unit, kind: 'review' } }
    }
    return { reason: week.practiceBlockedReason ?? 'Hoy no hay práctica pendiente.' }
  }

  private prefetch(target: Target): void {
    const session = this.findSession(target) ?? this.createSession(target)
    // De a una generación en segundo plano para no gastar de más.
    if (this.generating.size > 0 && !this.generating.has(session.id)) return
    this.ensurePool(session).catch((err) => console.error('[practice] No se pudo preparar la práctica', err))
  }

  private prefetchUpcoming(today: string): void {
    try {
      const { week } = this.progression.getState(today)
      const unit = week?.units.find((u) => !u.completedOn)
      if (week && unit) this.prefetch({ purpose: 'unit', weekId: week.id, unit })
    } catch (err) {
      console.error('[practice] No se pudo preparar la próxima práctica', err)
    }
  }

  private ensurePool(session: SessionRow): Promise<void> {
    if (this.exerciseRows(session.id).length > 0) return Promise.resolve()

    let pending = this.generating.get(session.id)
    if (!pending) {
      const { topic, subtopic } = this.content(session.topic_id, session.subtopic_id)
      const avoid = (
        this.db
          .prepare('SELECT payload FROM exercises WHERE topic_id = ? AND subtopic_id = ? ORDER BY id DESC LIMIT ?')
          .all(session.topic_id, session.subtopic_id, AVOID_RECENT) as unknown as { payload: string }[]
      ).map((r) => mainText(JSON.parse(r.payload) as StoredExercise))

      pending = this.generatePool({ topic, subtopic, kind: session.kind, counts: planPool(subtopic.focus, this.preferences()), avoid })
        .then((exercises) => {
          if (this.exerciseRows(session.id).length > 0) return
          const insert = this.db.prepare(
            'INSERT INTO exercises (topic_id, subtopic_id, skill, type, payload, session_id) VALUES (?, ?, ?, ?, ?, ?)'
          )
          transaction(this.db, () => {
            for (const e of exercises) {
              insert.run(session.topic_id, session.subtopic_id, SKILL_OF_TYPE[e.type], e.type, JSON.stringify(e), session.id)
            }
          })
        })
        .finally(() => this.generating.delete(session.id))
      this.generating.set(session.id, pending)
    }
    return pending
  }

  private assignSlots(session: SessionRow): void {
    const { subtopic } = this.content(session.topic_id, session.subtopic_id)
    const pool = this.exerciseRows(session.id).filter((r) => !r.skipped)
    const ids = composeSession(pool, subtopic.focus, this.preferences())
    const update = this.db.prepare('UPDATE exercises SET slot = ? WHERE id = ?')
    transaction(this.db, () => ids.forEach((id, i) => update.run(i + 1, id)))
  }

  private sessionView(session: SessionRow): SessionView {
    const rows = this.exerciseRows(session.id)
    const attempts = new Map(
      (
        this.db
          .prepare(
            'SELECT a.exercise_id, a.answer, a.feedback, a.user_rating FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id WHERE e.session_id = ?'
          )
          .all(session.id) as unknown as AttemptRow[]
      ).map((a) => [a.exercise_id, a])
    )
    const exercises = rows
      .filter((r) => r.slot !== null)
      .sort((a, b) => a.slot! - b.slot!)
      .map((r) => {
        const attempt = attempts.get(r.id)
        return {
          id: r.id,
          slot: r.slot!,
          type: r.type,
          content: toPublicExercise(JSON.parse(r.payload) as StoredExercise),
          answer: attempt ? (JSON.parse(attempt.answer) as ExerciseAnswer) : null,
          feedback: attempt ? (JSON.parse(attempt.feedback) as ExerciseFeedback) : null,
          rating: attempt?.user_rating ?? null
        }
      })

    const { topic, subtopic } = this.content(session.topic_id, session.subtopic_id)
    const unit = session.unit_id
      ? (this.db.prepare('SELECT unit_index FROM practice_units WHERE id = ?').get(session.unit_id) as { unit_index: number } | undefined)
      : undefined
    const completed = session.completed_on !== null

    return {
      id: session.id,
      purpose: session.unit_id === null ? 'recovery' : 'unit',
      unitIndex: unit?.unit_index ?? null,
      kind: session.kind,
      topicTitle: topic.title,
      subtopicTitle: subtopic.title,
      exercises,
      spareCount: rows.filter((r) => r.slot === null && !r.skipped).length,
      completed,
      canFinish: !completed && exercises.length > 0 && exercises.every((e) => e.feedback !== null)
    }
  }

  private findSession(target: Target): SessionRow | null {
    const row =
      target.purpose === 'unit'
        ? this.db.prepare('SELECT * FROM practice_sessions WHERE unit_id = ?').get(target.unit.id)
        : this.db
            .prepare('SELECT * FROM practice_sessions WHERE week_id = ? AND unit_id IS NULL AND completed_on IS NULL ORDER BY id DESC LIMIT 1')
            .get(target.weekId)
    return (row as SessionRow | undefined) ?? null
  }

  private createSession(target: Target): SessionRow {
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO practice_sessions (week_id, unit_id, topic_id, subtopic_id, kind) VALUES (?, ?, ?, ?, ?)')
      .run(target.weekId, target.purpose === 'unit' ? target.unit.id : null, target.unit.topicId, target.unit.subtopicId, target.unit.kind)
    return this.session(Number(lastInsertRowid))
  }

  private session(id: number): SessionRow {
    const row = this.db.prepare('SELECT * FROM practice_sessions WHERE id = ?').get(id) as SessionRow | undefined
    if (!row) throw new PracticeError('Esa práctica no existe.')
    return row
  }

  private openExercise(exerciseId: number, { allowCompleted = false } = {}): { exercise: ExerciseRow; session: SessionRow } {
    const exercise = this.db
      .prepare('SELECT id, type, payload, slot, skipped, session_id FROM exercises WHERE id = ?')
      .get(exerciseId) as ExerciseRow | undefined
    if (!exercise || exercise.session_id === null) throw new PracticeError('Ese ejercicio no existe.')
    const session = this.session(exercise.session_id)
    if (session.completed_on && !allowCompleted) throw new PracticeError('Esta práctica ya está terminada.')
    if (exercise.slot === null) throw new PracticeError('Ese ejercicio no es parte de la práctica.')
    return { exercise, session }
  }

  private exerciseRows(sessionId: number): ExerciseRow[] {
    return this.db
      .prepare('SELECT id, type, payload, slot, skipped, session_id FROM exercises WHERE session_id = ? ORDER BY id')
      .all(sessionId) as unknown as ExerciseRow[]
  }

  private hasSlots(sessionId: number): boolean {
    return this.db.prepare('SELECT 1 FROM exercises WHERE session_id = ? AND slot IS NOT NULL LIMIT 1').get(sessionId) !== undefined
  }

  private attempt(exerciseId: number): boolean {
    return this.db.prepare('SELECT 1 FROM exercise_attempts WHERE exercise_id = ?').get(exerciseId) !== undefined
  }

  private preferences(): TypePreferences {
    const rows = this.db
      .prepare(
        'SELECT e.type AS type, AVG(a.user_rating) AS rating FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id WHERE a.user_rating IS NOT NULL GROUP BY e.type'
      )
      .all() as unknown as { type: ExerciseType; rating: number }[]
    return Object.fromEntries(rows.map((r) => [r.type, r.rating]))
  }

  private content(topicId: string, subtopicId: string): { topic: CurriculumTopic; subtopic: Subtopic } {
    const topic = this.topics.get(topicId)
    const subtopic = topic?.subtopics.find((s) => s.id === subtopicId)
    if (!topic || !subtopic) throw new PracticeError(`El subtema ${topicId}/${subtopicId} ya no existe en el temario.`)
    return { topic, subtopic }
  }
}
