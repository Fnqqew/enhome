// Meta diaria: minutos de estudio o cantidad de actividades del día, en el curso abierto.

import type { GoalView } from '../../shared/goal'
import type { AppSettings } from '../../shared/settings'
import type { Db } from '../db/database'

// Un pedido de la interfaz suma como mucho esto (se manda cada medio minuto de estudio activo).
const MAX_SECONDS_PER_CALL = 60

export function addStudyTime(db: Db, day: string, seconds: number): void {
  const amount = Math.max(0, Math.min(MAX_SECONDS_PER_CALL, Math.round(seconds)))
  if (amount === 0) return
  db.prepare('INSERT INTO study_time (day, seconds) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET seconds = seconds + excluded.seconds').run(
    day,
    amount
  )
}

export function studyMinutes(db: Db, day: string): number {
  const row = db.prepare('SELECT seconds FROM study_time WHERE day = ?').get(day) as { seconds: number } | undefined
  return Math.floor((row?.seconds ?? 0) / 60)
}

// Lo que se hizo hoy: la práctica, partidas, lecturas, la entrada del diario y charlas nuevas.
export function activitiesToday(db: Db, day: string): number {
  const count = (sql: string): number => (db.prepare(sql).get(day) as { n: number }).n
  return (
    count('SELECT COUNT(*) AS n FROM practice_sessions WHERE completed_on = ?') +
    count('SELECT COUNT(*) AS n FROM game_scores WHERE played_on = ?') +
    count('SELECT COUNT(*) AS n FROM readings WHERE created_on = ?') +
    count('SELECT COUNT(*) AS n FROM journal WHERE day = ? AND review IS NOT NULL') +
    count('SELECT COUNT(*) AS n FROM chats WHERE created_on = ?')
  )
}

export function goalView(db: Db, goal: AppSettings['dailyGoal'], today: string): GoalView {
  if (goal.kind === 'off') return { kind: 'off', target: 0, done: 0, met: true }
  const done = goal.kind === 'minutes' ? studyMinutes(db, today) : activitiesToday(db, today)
  return { kind: goal.kind, target: goal.amount, done, met: done >= goal.amount }
}
