// Estadísticas del curso a partir de lo guardado: respuestas, prácticas, exámenes y actividad.

import { SKILLS, type CurriculumTopic, type Skill } from '../../shared/curriculum'
import { addDays, mondayOf } from '../../shared/dates'
import type { StatsView } from '../../shared/stats'
import type { Db } from '../db/database'

const WEEKS = 12
const ACTIVITY_DAYS = 182

const ratio = (correct: number, total: number): number | null => (total > 0 ? Math.round((correct / total) * 100) : null)

export function buildStats(db: Db, curriculum: CurriculumTopic[], today: string): StatsView {
  const recentSince = addDays(today, -28)
  const skillRows = db
    .prepare(
      `SELECT e.skill AS skill, COUNT(*) AS total, SUM(a.correct = 1) AS correct,
              SUM(CASE WHEN substr(a.created_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS recentTotal,
              SUM(CASE WHEN substr(a.created_at, 1, 10) >= ? AND a.correct = 1 THEN 1 ELSE 0 END) AS recentCorrect
         FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id
        GROUP BY e.skill`
    )
    .all(recentSince, recentSince) as unknown as { skill: Skill; total: number; correct: number; recentTotal: number; recentCorrect: number }[]
  const skills = SKILLS.map((skill) => {
    const row = skillRows.find((r) => r.skill === skill)
    return {
      skill,
      answered: row?.total ?? 0,
      accuracy: ratio(row?.correct ?? 0, row?.total ?? 0),
      recentAccuracy: ratio(row?.recentCorrect ?? 0, row?.recentTotal ?? 0)
    }
  })

  const topicRows = db
    .prepare(
      `SELECT e.topic_id AS topicId, COUNT(*) AS total, SUM(a.correct = 1) AS correct
         FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id
        GROUP BY e.topic_id`
    )
    .all() as unknown as { topicId: string; total: number; correct: number }[]
  const grades = new Map(
    (db.prepare('SELECT topic_id, best_grade FROM topic_progress').all() as unknown as { topic_id: string; best_grade: number | null }[]).map((r) => [
      r.topic_id,
      r.best_grade
    ])
  )
  const topics = curriculum
    .map((t) => {
      const row = topicRows.find((r) => r.topicId === t.id)
      return {
        topicId: t.id,
        title: t.title,
        level: t.level,
        answered: row?.total ?? 0,
        accuracy: ratio(row?.correct ?? 0, row?.total ?? 0),
        bestGrade: grades.get(t.id) ?? null
      }
    })
    .filter((t) => t.answered > 0 || t.bestGrade !== null)

  const practiceDays = db
    .prepare('SELECT completed_on AS date FROM practice_sessions WHERE completed_on IS NOT NULL')
    .all() as unknown as { date: string }[]
  const thisWeek = mondayOf(today)
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (WEEKS - 1 - i))
    const end = addDays(weekStart, 7)
    return { weekStart, practices: practiceDays.filter((p) => p.date >= weekStart && p.date < end).length }
  })

  const exams = (
    db
      .prepare(
        `SELECT COALESCE(started_on, substr(submitted_at, 1, 10)) AS date, grade, passed, kind FROM exams
          WHERE status = 'submitted' AND kind IN ('weekly', 'mock') AND grade IS NOT NULL ORDER BY id`
      )
      .all() as unknown as { date: string; grade: number; passed: number | null; kind: 'weekly' | 'mock' }[]
  ).map((e) => ({ date: e.date, grade: e.grade, passed: e.passed === 1 || (e.kind === 'mock' && e.grade >= 8), kind: e.kind }))

  // Un punto de actividad por práctica terminada, partida, entrada del diario o lectura.
  const since = addDays(today, -(ACTIVITY_DAYS - 1))
  const counts = new Map<string, number>()
  const add = (rows: { date: string }[]): void => {
    for (const { date } of rows) if (date >= since && date <= today) counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  add(practiceDays)
  add(db.prepare('SELECT played_on AS date FROM game_scores').all() as unknown as { date: string }[])
  add(db.prepare('SELECT day AS date FROM journal').all() as unknown as { date: string }[])
  add(db.prepare('SELECT created_on AS date FROM readings').all() as unknown as { date: string }[])
  const activity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const date = addDays(since, i)
    return { date, count: counts.get(date) ?? 0 }
  })

  const answered = skills.reduce((sum, s) => sum + s.answered, 0)
  const correct = skillRows.reduce((sum, r) => sum + (r.correct ?? 0), 0)
  return {
    skills,
    topics,
    weeks,
    exams,
    activity,
    totals: {
      answered,
      accuracy: ratio(correct, answered),
      studyDays: [...counts.values()].filter((n) => n > 0).length,
      games: (db.prepare('SELECT COUNT(*) AS n FROM game_scores').get() as { n: number }).n
    }
  }
}
