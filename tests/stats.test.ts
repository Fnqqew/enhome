import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase } from '../src/main/db/database'
import { buildStats } from '../src/main/stats/stats'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'))
const TODAY = '2026-10-16'

describe('estadísticas', () => {
  it('cuenta aciertos por habilidad, prácticas por semana, notas y actividad', () => {
    const db = openDatabase(':memory:')
    const topic = curriculum[0]
    db.prepare("INSERT INTO weeks (id, topic_id, week_start, starts_on, kind, status) VALUES (1, ?, '2026-10-12', '2026-10-12', 'normal', 'active')").run(topic.id)
    db.prepare("INSERT INTO practice_sessions (id, week_id, topic_id, subtopic_id, kind, completed_on) VALUES (1, 1, ?, 's', 'lesson', '2026-10-13')").run(topic.id)
    const insert = db.prepare("INSERT INTO exercises (id, topic_id, subtopic_id, skill, type, payload, session_id, slot) VALUES (?, ?, 's', ?, 'mcq', '{}', 1, ?)")
    const attempt = db.prepare("INSERT INTO exercise_attempts (exercise_id, answer, correct, created_at) VALUES (?, '\"x\"', ?, '2026-10-13 12:00:00')")
    ;[
      [1, 'grammar', 1],
      [2, 'grammar', 0],
      [3, 'reading', 1],
      [4, 'writing', 1]
    ].forEach(([id, skill, correct]) => {
      insert.run(id, topic.id, skill, id)
      attempt.run(id, correct)
    })
    db.prepare("INSERT INTO exams (kind, status, questions, grade, passed, started_on) VALUES ('weekly', 'submitted', '[]', 8.5, 1, '2026-10-10')").run()
    db.prepare("INSERT INTO game_scores (game, score, played_on) VALUES ('memotest', 80, '2026-10-15')").run()

    const stats = buildStats(db, curriculum, TODAY)
    expect(stats.skills.find((s) => s.skill === 'grammar')).toMatchObject({ answered: 2, accuracy: 50 })
    expect(stats.totals).toMatchObject({ answered: 4, accuracy: 75, studyDays: 2, games: 1 })
    expect(stats.weeks.at(-1)).toEqual({ weekStart: '2026-10-12', practices: 1 })
    expect(stats.exams).toEqual([{ date: '2026-10-10', grade: 8.5, passed: true, kind: 'weekly' }])
    expect(stats.topics[0]).toMatchObject({ topicId: topic.id, answered: 4, accuracy: 75 })
    expect(stats.activity).toHaveLength(182)
    expect(stats.activity.at(-1)).toEqual({ date: TODAY, count: 0 })
  })
})
