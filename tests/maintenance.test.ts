import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../src/main/db/database'
import { cleanupUnusedExercises, pruneTimings, runMaintenance } from '../src/main/db/maintenance'
import { saveTiming, timingStats } from '../src/main/db/timings-repo'
import { initialBounds, isVisible } from '../src/main/window-state'

let db: Db

beforeEach(() => {
  db = openDatabase(':memory:')
  db.prepare("INSERT INTO weeks (id, topic_id, week_start, starts_on, kind, status) VALUES (1, 't', '2026-08-03', '2026-08-03', 'normal', 'passed')").run()
})

function session(id: number, completedOn: string | null): void {
  db.prepare("INSERT INTO practice_sessions (id, week_id, topic_id, subtopic_id, kind, completed_on) VALUES (?, 1, 't', 's', 'lesson', ?)").run(id, completedOn)
}

function exercise(id: number, sessionId: number, slot: number | null): void {
  db.prepare("INSERT INTO exercises (id, topic_id, subtopic_id, skill, type, payload, session_id, slot) VALUES (?, 't', 's', 'grammar', 'mcq', '{}', ?, ?)").run(
    id,
    sessionId,
    slot
  )
}

const ids = (): number[] => (db.prepare('SELECT id FROM exercises ORDER BY id').all() as { id: number }[]).map((r) => r.id)

describe('limpieza de ejercicios sobrantes', () => {
  it('borra solo las alternativas sin usar de prácticas viejas', () => {
    session(1, '2026-08-03')
    session(2, '2026-09-30')
    session(3, null)
    exercise(1, 1, 1) // usado: queda
    exercise(2, 1, null) // alternativa vieja: se borra
    exercise(3, 2, null) // práctica reciente: queda
    exercise(4, 3, null) // práctica sin terminar: queda
    exercise(5, 1, null) // tiene un intento guardado: queda
    db.prepare("INSERT INTO exercise_attempts (exercise_id, answer) VALUES (5, '\"x\"')").run()

    expect(cleanupUnusedExercises(db, '2026-10-16')).toBe(1)
    expect(ids()).toEqual([1, 3, 4, 5])
  })

  it('el mantenimiento corre una vez por día y compacta la base', () => {
    session(1, '2026-08-03')
    exercise(1, 1, null)
    runMaintenance(db, '2026-10-16')
    expect(ids()).toEqual([])
    const tasks = db.prepare('SELECT task, last_on FROM maintenance ORDER BY task').all()
    expect(tasks).toEqual([
      { task: 'compactación', last_on: '2026-10-16' },
      { task: 'limpieza', last_on: '2026-10-16' }
    ])
  })
})

describe('tiempos de Claude', () => {
  it('resume por tarea con el promedio general y el reciente', () => {
    for (const ms of [10_000, 10_000, 10_000, 10_000, 10_000, 4_000, 4_000, 4_000, 4_000, 4_000]) {
      saveTiming(db, { label: 'corrección', model: 'sonnet', effort: null, ms, attempts: 1, ok: true })
    }
    saveTiming(db, { label: 'práctica', model: 'sonnet', effort: null, ms: 90_000, attempts: 3, ok: false })

    const [grading, practice] = timingStats(db)
    expect(grading).toMatchObject({ label: 'corrección', calls: 10, failures: 0, averageMs: 7_000, recentMs: 4_000 })
    expect(practice).toMatchObject({ label: 'práctica', calls: 1, failures: 1, retries: 2, averageMs: 0 })
  })

  it('guarda solo los últimos 500', () => {
    for (let i = 0; i < 510; i++) saveTiming(db, { label: 'x', model: 'sonnet', effort: null, ms: 1, attempts: 1, ok: true })
    pruneTimings(db)
    expect(timingStats(db)[0].calls).toBe(500)
  })
})

describe('tamaño y posición de la ventana', () => {
  const screen = { x: 0, y: 0, width: 1920, height: 1040 }

  it('sin datos guardados abre con el tamaño de siempre', () => {
    expect(initialBounds(null, [screen])).toEqual({ width: 1200, height: 800, maximized: false })
  })

  it('vuelve a la posición guardada si se ve en alguna pantalla', () => {
    const saved = { x: 100, y: 50, width: 1000, height: 700, maximized: true }
    expect(initialBounds(saved, [screen])).toEqual(saved)
  })

  it('si la pantalla ya no está, conserva el tamaño pero la centra', () => {
    const saved = { x: 2500, y: 100, width: 1000, height: 700, maximized: false }
    expect(isVisible(saved, [screen])).toBe(false)
    expect(initialBounds(saved, [screen])).toEqual({ width: 1000, height: 700, maximized: false })
  })

  it('una ventana casi afuera del borde no cuenta como visible', () => {
    expect(isVisible({ x: 1880, y: 0, width: 800, height: 600 }, [screen])).toBe(false)
    expect(isVisible({ x: 1700, y: 0, width: 800, height: 600 }, [screen])).toBe(true)
  })
})
