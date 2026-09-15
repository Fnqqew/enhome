// Inventario de comodines (acceso directo a la base, lo usan práctica, exámenes y recompensas).

import { POWER_UPS, type PowerUpId, type SecondChanceView } from '../../shared/rewards'
import type { Db } from '../db/database'

export class InventoryError extends Error {}

const EMPTY_MESSAGE: Record<PowerUpId, string> = {
  hint: 'No tenés pistas disponibles.',
  'second-chance': 'No tenés segundas oportunidades disponibles.',
  'streak-shield': 'No tenés protectores de racha.'
}

export function quantity(db: Db, item: PowerUpId): number {
  const row = db.prepare('SELECT quantity FROM inventory WHERE item = ?').get(item) as { quantity: number } | undefined
  return row?.quantity ?? 0
}

// Otorga un comodín una sola vez por source. Si ya se tiene el máximo, el hito queda registrado igual.
export function grant(db: Db, item: PowerUpId, source: string, today: string): boolean {
  if (db.prepare('SELECT 1 FROM reward_grants WHERE source = ?').get(source)) return false
  db.prepare('INSERT INTO reward_grants (source, item, granted_on) VALUES (?, ?, ?)').run(source, item, today)
  if (quantity(db, item) >= POWER_UPS[item].max) return false
  db.prepare('INSERT INTO inventory (item, quantity) VALUES (?, 1) ON CONFLICT (item) DO UPDATE SET quantity = quantity + 1').run(item)
  return true
}

export function consume(db: Db, item: PowerUpId): void {
  if (quantity(db, item) < 1) throw new InventoryError(EMPTY_MESSAGE[item])
  db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE item = ?').run(item)
}

export const hintContext = (exerciseId: number): string => `hint:exercise:${exerciseId}`
export const secondChanceContext = (examId: number): string => `second-chance:exam:${examId}`

// Pistas ya reveladas, por id de ejercicio.
export function usedHints(db: Db): Map<number, string> {
  const rows = db.prepare("SELECT context, detail FROM powerup_uses WHERE item = 'hint'").all() as unknown as { context: string; detail: string }[]
  return new Map(rows.map((r) => [Number(r.context.split(':')[2]), r.detail]))
}

export function secondChanceFor(db: Db, examId: number): SecondChanceView {
  const row = db.prepare('SELECT detail FROM powerup_uses WHERE context = ?').get(secondChanceContext(examId)) as { detail: string } | undefined
  return {
    available: quantity(db, 'second-chance'),
    used: row ? (JSON.parse(row.detail) as { index: number; correct: boolean }) : null
  }
}
