// Tiempos de los pedidos a Claude, para la sección Acerca de.

import type { ClaudeTiming } from '../claude/bridge'
import type { ClaudeTimingStat } from '../../shared/ipc'
import type { Db } from './database'

const RECENT = 5

export function saveTiming(db: Db, timing: ClaudeTiming): void {
  db.prepare('INSERT INTO claude_timings (label, model, effort, ms, attempts, ok) VALUES (?, ?, ?, ?, ?, ?)').run(
    timing.label,
    timing.model,
    timing.effort,
    Math.round(timing.ms),
    timing.attempts,
    timing.ok ? 1 : 0
  )
}

// Por tarea: el promedio de todo lo guardado y el de los últimos pedidos, para ver si empeora.
export function timingStats(db: Db): ClaudeTimingStat[] {
  const rows = db
    .prepare('SELECT label, ms, attempts, ok FROM claude_timings ORDER BY id DESC')
    .all() as unknown as { label: string; ms: number; attempts: number; ok: number }[]

  const byLabel = new Map<string, typeof rows>()
  for (const row of rows) byLabel.set(row.label, [...(byLabel.get(row.label) ?? []), row])

  const average = (values: number[]): number => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0)
  return [...byLabel.entries()]
    .map(([label, list]) => {
      const ok = list.filter((r) => r.ok === 1)
      return {
        label,
        calls: list.length,
        failures: list.length - ok.length,
        retries: list.reduce((sum, r) => sum + r.attempts - 1, 0),
        averageMs: average(ok.map((r) => r.ms)),
        recentMs: average(ok.slice(0, RECENT).map((r) => r.ms))
      }
    })
    .sort((a, b) => b.calls - a.calls)
}
