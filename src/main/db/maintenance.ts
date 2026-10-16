// Mantenimiento de cada base: borra lo que ya no sirve y la compacta de vez en cuando.

import { addDays } from '../../shared/dates'
import type { Db } from './database'

// Cada práctica genera ejercicios de más para poder cambiar uno; los que no se usaron
// dejan de servir cuando la práctica terminó hace un tiempo.
const UNUSED_EXERCISES_DAYS = 30
const VACUUM_EVERY_DAYS = 30
const TIMINGS_KEPT = 500

export function cleanupUnusedExercises(db: Db, today: string): number {
  const before = addDays(today, -UNUSED_EXERCISES_DAYS)
  const result = db
    .prepare(
      `DELETE FROM exercises
        WHERE slot IS NULL
          AND session_id IN (SELECT id FROM practice_sessions WHERE completed_on IS NOT NULL AND completed_on < ?)
          AND NOT EXISTS (SELECT 1 FROM exercise_attempts a WHERE a.exercise_id = exercises.id)
          AND NOT EXISTS (SELECT 1 FROM powerup_uses p WHERE p.context = 'hint:exercise:' || exercises.id)`
    )
    .run(before)
  return Number(result.changes)
}

export function pruneTimings(db: Db): void {
  db.prepare('DELETE FROM claude_timings WHERE id <= (SELECT MAX(id) FROM claude_timings) - ?').run(TIMINGS_KEPT)
}

function lastRun(db: Db, task: string): string | null {
  const row = db.prepare('SELECT last_on FROM maintenance WHERE task = ?').get(task) as { last_on: string } | undefined
  return row?.last_on ?? null
}

function markRun(db: Db, task: string, today: string): void {
  db.prepare('INSERT INTO maintenance (task, last_on) VALUES (?, ?) ON CONFLICT (task) DO UPDATE SET last_on = excluded.last_on').run(task, today)
}

// Se llama al abrir cada base. La limpieza corre una vez por día y la compactación una vez al mes.
export function runMaintenance(db: Db, today: string): void {
  try {
    if (lastRun(db, 'limpieza') !== today) {
      cleanupUnusedExercises(db, today)
      pruneTimings(db)
      markRun(db, 'limpieza', today)
    }
    const vacuumed = lastRun(db, 'compactación')
    if (!vacuumed || vacuumed <= addDays(today, -VACUUM_EVERY_DAYS)) {
      db.exec('VACUUM')
      markRun(db, 'compactación', today)
    }
    db.exec('PRAGMA optimize')
  } catch (error) {
    // El mantenimiento nunca debe impedir abrir la app.
    console.error('Falló el mantenimiento de la base', error)
  }
}
