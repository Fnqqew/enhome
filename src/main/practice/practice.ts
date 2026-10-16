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
import { composeLong, composeSession, composeShort, isLongType, longSlots, planPool, type TypePreferences } from './composition'
import { mainText, toPublicExercise } from './exercises'
import type { PoolGenerator } from './generation'
import { gradeAuto } from './grading'
import { quantity, usedHints } from '../rewards/inventory'

export class PracticeError extends Error {}

const AVOID_RECENT = 20

// Por cuál se reemplaza cada ejercicio largo al cambiarlo, en orden de preferencia.
const REPLACEMENT_FAMILY: Partial<Record<ExerciseType, ExerciseType[]>> = {
  dialogue: ['roleplay', 'dialogue'],
  roleplay: ['dialogue', 'roleplay'],
  translation_set: ['translation_set', 'translation'],
  reading: ['reading'],
  writing: ['writing']
}

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

// Una generación en curso: startable se cumple cuando llega la tanda corta (ya se puede empezar)
// y done cuando están todos los ejercicios.
interface Generation {
  startable: Promise<void>
  done: Promise<void>
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export class Practice {
  private readonly generating = new Map<number, Generation>()
  // Por qué falló la tanda larga de una sesión que ya empezó, para mostrarlo con «Reintentar».
  private readonly failures = new Map<number, string>()
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

    const session = this.repairSession(this.findSession(target), target)
    if (session && this.hasSlots(session.id)) {
      // Una sesión que arrancó con los cortos y quedó sin los largos (por ejemplo, se cerró la app) los vuelve a pedir.
      if (this.waitingLong(session) && !this.generating.has(session.id) && !this.failures.has(session.id)) this.launch(session)
      return { status: 'session', session: this.sessionView(session) }
    }

    // Mientras el alumno lee la introducción, se preparan los ejercicios.
    this.prefetch(target)
    const { topic, subtopic } = this.content(target.unit.topicId, target.unit.subtopicId, target.unit.index)
    return {
      status: 'ready',
      topicId: topic.id,
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

  // Al abrir la app (o cambiar de día o de idioma) se prepara la práctica pendiente en segundo
  // plano, así al entrar a Práctica ya está lista.
  warmUp(today: string): void {
    const target = this.target(today)
    if ('reason' in target) return
    const session = this.findSession(target)
    if (session && this.hasSlots(session.id)) return
    this.prefetch(target)
  }

  async start(today: string): Promise<PracticeView> {
    const target = this.target(today)
    if ('reason' in target) throw new PracticeError(target.reason)
    const session = this.repairSession(this.findSession(target), target) ?? this.createSession(target)
    // Reintentar después de una falla de los largos vuelve a pedirlos.
    this.failures.delete(session.id)
    const generation = this.ensurePool(session)
    if (!this.hasSlots(session.id)) {
      // Se empieza apenas están los cortos; los largos ocupan sus lugares cuando llegan.
      await generation.startable
      if (!this.hasSlots(session.id)) this.assignSlots(this.session(session.id))
    }
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
      const answers = 'text' in answer ? [answer.text] : 'texts' in answer ? answer.texts : []
      feedback = await this.gradeOpen({ topic, subtopic, exercise: stored as OpenExercise, answers })
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
    // Los ejercicios largos se cambian por uno equivalente para que la práctica no pierda peso.
    const family = REPLACEMENT_FAMILY[exercise.type]
    const replacement = family
      ? (family.map((type) => spares.find((r) => r.type === type)).find(Boolean) ?? spares.find(sameSkill) ?? spares[0])
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
    const session = this.repairSession(this.findSession(target), target) ?? this.createSession(target)
    // De a una generación en segundo plano para no gastar de más.
    if (this.generating.size > 0 && !this.generating.has(session.id)) return
    this.ensurePool(session)
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

  // Qué partes de los ejercicios ya están guardadas: la tanda corta y la larga llegan por separado.
  private poolState(sessionId: number): { short: boolean; long: boolean } {
    const rows = this.exerciseRows(sessionId)
    return { short: rows.some((r) => !isLongType(r.type)), long: rows.some((r) => isLongType(r.type)) }
  }

  // Una sesión ya empezada con solo ejercicios cortos está esperando los largos.
  private waitingLong(session: SessionRow): boolean {
    if (session.completed_on) return false
    const slotted = this.exerciseRows(session.id).filter((r) => r.slot !== null)
    return slotted.length > 0 && !slotted.some((r) => isLongType(r.type))
  }

  private ensurePool(session: SessionRow): Generation {
    const running = this.generating.get(session.id)
    if (running) return running
    const state = this.poolState(session.id)
    if (state.short && state.long) return { startable: Promise.resolve(), done: Promise.resolve() }
    return this.launch(session)
  }

  // Pide a Claude lo que falta (todo, o solo la tanda que no llegó) y guarda cada tanda apenas está.
  private launch(session: SessionRow): Generation {
    const state = this.poolState(session.id)
    const { topic, subtopic } = this.content(session.topic_id, session.subtopic_id)
    const avoid = (
      this.db
        .prepare('SELECT payload FROM exercises WHERE topic_id = ? AND subtopic_id = ? ORDER BY id DESC LIMIT ?')
        .all(session.topic_id, session.subtopic_id, AVOID_RECENT) as unknown as { payload: string }[]
    ).map((r) => mainText(JSON.parse(r.payload) as StoredExercise))
    const counts = Object.fromEntries(
      Object.entries(planPool(subtopic.focus, this.preferences())).filter(([type]) => {
        const long = isLongType(type as ExerciseType)
        return state.short ? long : state.long ? !long : true
      })
    )

    let ready!: () => void
    let fail!: (err: unknown) => void
    const startable = new Promise<void>((resolve, reject) => {
      ready = resolve
      fail = reject
    })
    // Quien no espera a que se pueda empezar no tiene que ver un rechazo sin manejar.
    startable.catch(() => undefined)
    if (state.short) ready()

    let savedByGroup = false
    const save = (exercises: StoredExercise[]): void => {
      const insert = this.db.prepare('INSERT INTO exercises (topic_id, subtopic_id, skill, type, payload, session_id) VALUES (?, ?, ?, ?, ?, ?)')
      transaction(this.db, () => {
        for (const e of exercises) insert.run(session.topic_id, session.subtopic_id, SKILL_OF_TYPE[e.type], e.type, JSON.stringify(e), session.id)
      })
      if (exercises.some((e) => !isLongType(e.type))) ready()
      if (exercises.some((e) => isLongType(e.type))) this.fillLongSlots(this.session(session.id))
    }

    const done = this.generatePool({
      topic,
      subtopic,
      kind: session.kind,
      counts,
      avoid,
      onGroup: (group) => {
        savedByGroup = true
        save(group)
      }
    })
      .then((exercises) => {
        if (!savedByGroup) save(exercises)
        ready()
      })
      .catch((err) => {
        fail(err)
        this.failures.set(session.id, errorText(err))
        console.error('[practice] No se pudieron preparar los ejercicios', err)
      })
      .finally(() => this.generating.delete(session.id))

    const generation = { startable, done }
    this.generating.set(session.id, generation)
    return generation
  }

  // Con todos los ejercicios arma la sesión entera; si solo están los cortos, la primera parte.
  private assignSlots(session: SessionRow): void {
    const { subtopic } = this.content(session.topic_id, session.subtopic_id)
    const pool = this.exerciseRows(session.id).filter((r) => !r.skipped)
    const ids = this.poolState(session.id).long
      ? composeSession(pool, subtopic.focus, this.preferences())
      : composeShort(pool, subtopic.focus, this.preferences())
    const update = this.db.prepare('UPDATE exercises SET slot = ? WHERE id = ?')
    transaction(this.db, () => ids.forEach((id, i) => update.run(i + 1, id)))
  }

  // Los largos llegaron con la sesión ya empezada: ocupan los lugares que quedaron al final.
  private fillLongSlots(session: SessionRow): void {
    if (!this.waitingLong(session)) return
    const { subtopic } = this.content(session.topic_id, session.subtopic_id)
    const rows = this.exerciseRows(session.id)
    const last = Math.max(...rows.map((r) => r.slot ?? 0))
    const ids = composeLong(
      rows.filter((r) => r.slot === null && !r.skipped),
      subtopic.focus
    )
    const update = this.db.prepare('UPDATE exercises SET slot = ? WHERE id = ?')
    transaction(this.db, () => ids.forEach((id, i) => update.run(last + i + 1, id)))
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
    const hints = usedHints(this.db)
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
          rating: attempt?.user_rating ?? null,
          hint: hints.get(r.id) ?? null
        }
      })

    const { topic, subtopic } = this.content(session.topic_id, session.subtopic_id)
    const pendingCount = this.waitingLong(session) ? longSlots(subtopic.focus) : 0
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
      hintsAvailable: quantity(this.db, 'hint'),
      completed,
      pendingCount,
      pendingError: pendingCount > 0 ? (this.failures.get(session.id) ?? null) : null,
      canFinish: !completed && pendingCount === 0 && exercises.length > 0 && exercises.every((e) => e.feedback !== null)
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

  // Si el temario cambió y el subtema guardado ya no existe, se usa el del mismo día del tópico.
  private content(topicId: string, subtopicId: string, day?: number): { topic: CurriculumTopic; subtopic: Subtopic } {
    const topic = this.topics.get(topicId)
    if (!topic) {
      throw new PracticeError(
        `El tópico «${topicId}» ya no está en el temario. Si editaste los archivos del curso, volvé a ponerlo o reiniciá el curso desde Ajustes.`
      )
    }
    const subtopic = topic.subtopics.find((s) => s.id === subtopicId) ?? topic.subtopics.find((s) => s.day === day) ?? topic.subtopics[0]
    return { topic, subtopic }
  }

  // Una práctica guardada de un subtema que ya no existe: si todavía no se respondió nada, se descartan
  // sus ejercicios y pasa al subtema actual para generarla de nuevo; si ya tiene respuestas, sigue como está.
  private repairSession(session: SessionRow | null, target: Target): SessionRow | null {
    const topic = this.topics.get(target.unit.topicId)
    const exists = (id: string): boolean => topic?.subtopics.some((s) => s.id === id) ?? false
    if (!topic || (exists(target.unit.subtopicId) && (!session || exists(session.subtopic_id)))) return session

    const { subtopic } = this.content(target.unit.topicId, target.unit.subtopicId, target.unit.index)
    const answered =
      session !== null &&
      this.db.prepare('SELECT 1 FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id WHERE e.session_id = ? LIMIT 1').get(session.id) !==
        undefined
    if (answered) return session

    console.warn(`[practice] El subtema ${target.unit.topicId}/${target.unit.subtopicId} ya no existe: la práctica pasa a ${subtopic.id}`)
    transaction(this.db, () => {
      if (target.purpose === 'unit') this.db.prepare('UPDATE practice_units SET subtopic_id = ? WHERE id = ?').run(subtopic.id, target.unit.id)
      if (session) {
        this.db.prepare('DELETE FROM exercises WHERE session_id = ?').run(session.id)
        this.db.prepare('UPDATE practice_sessions SET subtopic_id = ? WHERE id = ?').run(subtopic.id, session.id)
      }
    })
    target.unit = { ...target.unit, subtopicId: subtopic.id, subtopicTitle: subtopic.title }
    return session ? this.session(session.id) : null
  }
}
