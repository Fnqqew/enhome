// Pausas de un curso: mientras dura una, sus días no cuentan como faltas ni cortan la racha.

import type { Db } from '../db/database'

export interface PauseRecord {
  pausedOn: string
  // Primer día que vuelve a contar; null mientras sigue en pausa.
  resumedOn: string | null
}

export function loadPauses(db: Db): PauseRecord[] {
  return db.prepare('SELECT paused_on AS pausedOn, resumed_on AS resumedOn FROM course_pauses ORDER BY paused_on').all() as unknown as PauseRecord[]
}

export function openPause(pauses: PauseRecord[]): PauseRecord | null {
  return pauses.find((p) => p.resumedOn === null) ?? null
}

// Si un día cae dentro de alguna pausa.
export function isPausedDay(pauses: PauseRecord[], date: string): boolean {
  return pauses.some((p) => date >= p.pausedOn && (p.resumedOn === null || date < p.resumedOn))
}
