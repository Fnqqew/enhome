// Motor de progresión: semanas de tópico, prácticas, faltas, examen semanal y resultado del examen inicial.

import type { CurriculumTopic } from '../../shared/curriculum'
import { addDays, mondayOf } from '../../shared/dates'
import type { PracticeUnitView, ProgressState, UnitKind, WeekKind, WeekView } from '../../shared/progress'
import { transaction, type Db } from '../db/database'
import { detectWeakTopics, planCarryWeek, planLessonWeek, planRetryWeek, type AnswerTag, type PlannedUnit } from './planning'
import { PASS_GRADE, PRACTICE_DAYS } from './rules'
import { computeWeek, describeExam, firstWeekFor, type UnitRecord, type WeekRecord } from './week'

export class ProgressionError extends Error {}

type TopicStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'review'

const isPassed = (status: TopicStatus | undefined): boolean => status === 'passed' || status === 'review'

interface WeekRow {
  id: number
  topic_id: string
  week_start: string
  starts_on: string
  kind: WeekKind
  status: WeekRecord['status']
  recovered_on: string | null
}

interface UnitRow {
  id: number
  unit_index: number
  kind: UnitKind
  topic_id: string
  subtopic_id: string
  completed_on: string | null
}

export interface ExamSubmission {
  grade: number
  answers: AnswerTag[]
}

export interface ExamOutcome {
  passed: boolean
  nextWeekStart: string | null
  finished: boolean
  weakTopics: string[]
}

export class Progression {
  private readonly topics: Map<string, CurriculumTopic>

  // El temario tiene que venir ordenado (loadCurriculum lo devuelve así).
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[]
  ) {
    this.topics = new Map(curriculum.map((t) => [t.id, t]))
  }

  getState(today: string): ProgressState {
    return transaction(this.db, () => {
      this.rollover(today)
      const player = this.player()
      const statuses = this.topicStatuses()
      const week = this.activeWeek()
      const progress = week
        ? (this.db.prepare('SELECT attempts, failed_attempts FROM topic_progress WHERE topic_id = ?').get(week.topicId) as
            | { attempts: number; failed_attempts: number }
            | undefined)
        : undefined

      return {
        today,
        placementDone: player.placement_done_at !== null,
        placementInProgress:
          this.db.prepare("SELECT 1 FROM exams WHERE kind = 'placement' AND status = 'in_progress'").get() !== undefined,
        level: week ? this.topic(week.topicId).level : player.cefr_level,
        week: week ? this.toView(week, today) : null,
        finished: player.placement_done_at !== null && !week && this.curriculum.every((t) => isPassed(statuses.get(t.id))),
        reviewTopics: this.curriculum
          .filter((t) => statuses.get(t.id) === 'review')
          .map((t) => ({ id: t.id, title: t.title, level: t.level })),
        attempts: progress ? { attempts: progress.attempts, failed: progress.failed_attempts } : null
      }
    })
  }

  completeUnit(unitId: number, today: string): void {
    transaction(this.db, () => {
      this.rollover(today)
      const week = this.requireActiveWeek()
      const c = computeWeek(week, today)
      if (!c.canPracticeNow || !c.nextUnit) throw new ProgressionError(c.practiceBlockedReason ?? 'Ahora no hay práctica disponible.')
      if (c.nextUnit.id !== unitId) throw new ProgressionError('Esa práctica no es la próxima pendiente.')

      this.db.prepare('UPDATE practice_units SET completed_on = ? WHERE id = ?').run(today, unitId)
      // Practicar un domingo con faltas recupera una.
      if (c.canRecover) this.db.prepare('UPDATE weeks SET recovered_on = ? WHERE id = ?').run(today, week.id)
      // Repasar un tópico anterior marcado para repaso lo da por repasado.
      if (c.nextUnit.kind === 'review' && c.nextUnit.topicId !== week.topicId) {
        this.db
          .prepare("UPDATE topic_progress SET status = 'passed', updated_at = datetime('now') WHERE topic_id = ? AND status = 'review'")
          .run(c.nextUnit.topicId)
      }
    })
  }

  // Repaso del domingo cuando ya no quedan prácticas pendientes.
  recordRecoverySession(today: string): void {
    transaction(this.db, () => {
      this.rollover(today)
      const week = this.requireActiveWeek()
      const c = computeWeek(week, today)
      if (!c.canRecover) {
        throw new ProgressionError('Solo se puede recuperar una falta el domingo, una vez por semana y si hubo faltas.')
      }
      if (c.nextUnit) throw new ProgressionError('Primero completá la práctica pendiente: eso ya recupera la falta.')
      this.db.prepare('UPDATE weeks SET recovered_on = ? WHERE id = ?').run(today, week.id)
    })
  }

  submitWeeklyExam({ grade, answers }: ExamSubmission, today: string): ExamOutcome {
    if (!Number.isFinite(grade) || grade < 0 || grade > 10) throw new ProgressionError('La nota tiene que estar entre 0 y 10.')

    return transaction(this.db, () => {
      this.rollover(today)
      const week = this.requireActiveWeek()
      const c = computeWeek(week, today)
      if (c.examStatus !== 'available') throw new ProgressionError(describeExam(c, week))

      const topic = this.topic(week.topicId)
      const passed = grade >= PASS_GRADE
      const { lastInsertRowid: examId } = this.db
        .prepare(
          "INSERT INTO exams (kind, topic_id, status, questions, grade, passed, submitted_at) VALUES ('weekly', ?, 'submitted', '[]', ?, ?, datetime('now'))"
        )
        .run(topic.id, grade, passed ? 1 : 0)
      const insertAnswer = this.db.prepare(
        'INSERT INTO exam_answers (exam_id, question_index, answer, correct, topic_tag, subtopic_tag) VALUES (?, ?, NULL, ?, ?, ?)'
      )
      answers.forEach((a, i) => insertAnswer.run(examId, i, a.correct ? 1 : 0, a.topicId, a.subtopicId))

      this.db.prepare('UPDATE weeks SET status = ?, exam_id = ? WHERE id = ?').run(passed ? 'passed' : 'failed', examId, week.id)
      this.db
        .prepare(
          "UPDATE topic_progress SET attempts = attempts + 1, failed_attempts = failed_attempts + ?, best_grade = MAX(COALESCE(best_grade, 0), ?), updated_at = datetime('now') WHERE topic_id = ?"
        )
        .run(passed ? 0 : 1, grade, topic.id)

      const statuses = this.topicStatuses()
      const weakTopics = detectWeakTopics(answers, topic.id).filter((id) => isPassed(statuses.get(id)))
      for (const id of weakTopics) this.setTopicStatus(id, 'review')

      const nextMonday = addDays(mondayOf(today), 7)
      if (passed) {
        this.setTopicStatus(topic.id, 'passed', { passedOn: today })
        const next = this.nextPendingTopic()
        if (next) this.insertWeek(next.id, nextMonday, nextMonday, 'normal', planLessonWeek(next))
        return { passed, nextWeekStart: next ? nextMonday : null, finished: !next, weakTopics }
      }

      const { failed_attempts: failedAttempts } = this.db
        .prepare('SELECT failed_attempts FROM topic_progress WHERE topic_id = ?')
        .get(topic.id) as { failed_attempts: number }
      const prerequisites = topic.prerequisites.flatMap((id) => this.topics.get(id) ?? [])
      this.insertWeek(topic.id, nextMonday, nextMonday, 'retry', planRetryWeek(topic, answers, failedAttempts, prerequisites))
      return { passed, nextWeekStart: nextMonday, finished: false, weakTopics }
    })
  }

  // startTopicId null significa que el alumno superó todo el temario disponible.
  applyPlacementResult(startTopicId: string | null, answers: AnswerTag[], today: string): void {
    transaction(this.db, () => {
      if (this.player().placement_done_at !== null) throw new ProgressionError('El examen inicial ya se aplicó.')
      const startIndex = startTopicId === null ? this.curriculum.length : this.curriculum.findIndex((t) => t.id === startTopicId)
      if (startIndex < 0) throw new ProgressionError(`El tópico ${startTopicId} no existe en el temario.`)

      this.curriculum.forEach((t, i) => {
        if (i < startIndex) this.setTopicStatus(t.id, 'passed', { passedOn: today })
        else if (i > startIndex) this.setTopicStatus(t.id, 'locked')
      })
      const statuses = this.topicStatuses()
      for (const id of detectWeakTopics(answers, startTopicId)) {
        if (isPassed(statuses.get(id))) this.setTopicStatus(id, 'review')
      }

      const start = startTopicId ? this.topic(startTopicId) : null
      const level = (start ?? this.curriculum[this.curriculum.length - 1])?.level ?? null
      this.db.prepare('UPDATE player SET placement_done_at = ?, cefr_level = ? WHERE id = 1').run(today, level)
      if (start) {
        const { weekStart, startsOn } = firstWeekFor(today)
        this.insertWeek(start.id, weekStart, startsOn, 'normal', planLessonWeek(start))
      }
    })
  }

  resetProgress(): void {
    transaction(this.db, () => {
      this.db.exec(`
        DELETE FROM practice_units;
        DELETE FROM weeks;
        DELETE FROM exam_answers;
        DELETE FROM exams;
        DELETE FROM topic_progress;
        UPDATE player SET cefr_level = NULL, placement_done_at = NULL, xp = 0, player_level = 1,
          streak = 0, best_streak = 0, last_practice_date = NULL WHERE id = 1;
      `)
    })
  }

  // Cierra la semana activa si ya pasó su domingo sin resultado, o arranca un tópico si no hay semana.
  private rollover(today: string): void {
    const week = this.activeWeek()
    if (week) {
      const sunday = addDays(week.weekStart, 6)
      if (today <= sunday) return
      const pending: PlannedUnit[] = week.units
        .filter((u) => !u.completedOn)
        .map(({ kind, topicId, subtopicId }) => ({ kind, topicId, subtopicId }))
      this.db.prepare("UPDATE weeks SET status = 'incomplete' WHERE id = ?").run(week.id)
      const weekStart = mondayOf(today)
      // Si pasó más de una semana sin abrir la app, las faltas se cuentan desde hoy.
      const startsOn = weekStart === addDays(sunday, 1) ? weekStart : today
      this.insertWeek(week.topicId, weekStart, startsOn, 'carry', planCarryWeek(this.topic(week.topicId), pending))
      return
    }

    if (this.player().placement_done_at === null) return
    const next = this.nextPendingTopic()
    if (!next) return
    let { weekStart, startsOn } = firstWeekFor(today)
    if (this.db.prepare('SELECT 1 FROM weeks WHERE week_start = ?').get(weekStart)) {
      weekStart = addDays(weekStart, 7)
      startsOn = weekStart
    }
    this.insertWeek(next.id, weekStart, startsOn, 'normal', planLessonWeek(next))
  }

  private insertWeek(topicId: string, weekStart: string, startsOn: string, kind: WeekKind, units: PlannedUnit[]): void {
    const { lastInsertRowid: weekId } = this.db
      .prepare("INSERT INTO weeks (topic_id, week_start, starts_on, kind, status) VALUES (?, ?, ?, ?, 'active')")
      .run(topicId, weekStart, startsOn, kind)
    const insert = this.db.prepare(
      'INSERT INTO practice_units (week_id, unit_index, kind, topic_id, subtopic_id) VALUES (?, ?, ?, ?, ?)'
    )
    units.slice(0, PRACTICE_DAYS).forEach((u, i) => insert.run(weekId, i + 1, u.kind, u.topicId, u.subtopicId))
    this.setTopicStatus(topicId, 'in_progress', { weekStart })
  }

  private setTopicStatus(topicId: string, status: TopicStatus, extra: { weekStart?: string; passedOn?: string } = {}): void {
    this.db
      .prepare(
        `INSERT INTO topic_progress (topic_id, cefr_level, status, week_start, passed_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (topic_id) DO UPDATE SET
           status = excluded.status,
           week_start = COALESCE(excluded.week_start, topic_progress.week_start),
           passed_at = COALESCE(excluded.passed_at, topic_progress.passed_at),
           updated_at = datetime('now')`
      )
      .run(topicId, this.topic(topicId).level, status, extra.weekStart ?? null, extra.passedOn ?? null)
  }

  private toView(week: WeekRecord, today: string): WeekView {
    const c = computeWeek(week, today)
    const topic = this.topic(week.topicId)
    const unitView = (u: UnitRecord): PracticeUnitView => {
      const unitTopic = this.topic(u.topicId)
      return {
        id: u.id,
        index: u.index,
        kind: u.kind,
        topicId: unitTopic.id,
        topicTitle: unitTopic.title,
        subtopicId: u.subtopicId,
        subtopicTitle: unitTopic.subtopics.find((s) => s.id === u.subtopicId)?.title ?? u.subtopicId,
        completedOn: u.completedOn
      }
    }
    return {
      id: week.id,
      topicId: topic.id,
      topicTitle: topic.title,
      level: topic.level,
      kind: week.kind,
      weekStart: week.weekStart,
      startsOn: week.startsOn,
      days: c.days,
      units: week.units.map(unitView),
      faltas: c.faltas,
      recovered: c.recovered,
      effectiveFaltas: c.effectiveFaltas,
      completedUnits: c.completedUnits,
      nextUnit: c.nextUnit ? unitView(c.nextUnit) : null,
      canPracticeNow: c.canPracticeNow,
      practiceBlockedReason: c.practiceBlockedReason,
      canRecover: c.canRecover,
      examStatus: c.examStatus,
      examMessage: describeExam(c, week)
    }
  }

  private activeWeek(): WeekRecord | null {
    const row = this.db.prepare("SELECT * FROM weeks WHERE status = 'active' ORDER BY week_start DESC LIMIT 1").get() as
      | WeekRow
      | undefined
    if (!row) return null
    const units = this.db.prepare('SELECT * FROM practice_units WHERE week_id = ? ORDER BY unit_index').all(row.id) as unknown as UnitRow[]
    return {
      id: row.id,
      topicId: row.topic_id,
      weekStart: row.week_start,
      startsOn: row.starts_on,
      kind: row.kind,
      status: row.status,
      recoveredOn: row.recovered_on,
      units: units.map((u) => ({
        id: u.id,
        index: u.unit_index,
        kind: u.kind,
        topicId: u.topic_id,
        subtopicId: u.subtopic_id,
        completedOn: u.completed_on
      }))
    }
  }

  private requireActiveWeek(): WeekRecord {
    const week = this.activeWeek()
    if (!week) throw new ProgressionError('No hay una semana activa.')
    return week
  }

  private player(): { cefr_level: string | null; placement_done_at: string | null } {
    return this.db.prepare('SELECT cefr_level, placement_done_at FROM player WHERE id = 1').get() as {
      cefr_level: string | null
      placement_done_at: string | null
    }
  }

  private topicStatuses(): Map<string, TopicStatus> {
    const rows = this.db.prepare('SELECT topic_id, status FROM topic_progress').all() as unknown as { topic_id: string; status: TopicStatus }[]
    return new Map(rows.map((r) => [r.topic_id, r.status]))
  }

  private nextPendingTopic(): CurriculumTopic | undefined {
    const statuses = this.topicStatuses()
    return this.curriculum.find((t) => !isPassed(statuses.get(t.id)))
  }

  private topic(id: string): CurriculumTopic {
    const topic = this.topics.get(id)
    if (!topic) throw new ProgressionError(`El tópico ${id} ya no existe en el temario.`)
    return topic
  }
}
