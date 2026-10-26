// Tarjetas de repaso con FSRS (el algoritmo de Anki): errores, palabras, frases y oraciones guardadas.
// Cada tarjeta guarda su estado de memoria (estabilidad y dificultad) y vuelve justo antes de que se
// olvide. En unos 350 millones de repasos, FSRS predice el olvido mucho mejor que los intervalos fijos.

import { fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { addDays, toLocalDate } from '../../shared/dates'
import type { Db } from '../db/database'

export type CardKind = 'mistake' | 'word' | 'phrase' | 'sentence'

// Cómo salió el repaso: no me acordaba, me costó, bien, fácil.
export type Recall = 'again' | 'hard' | 'good' | 'easy'

const GRADE: Record<Recall, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }

// Retención pedida del 90 % y días enteros: la app repasa de a un día, sin pasos de minutos.
const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: false, enable_short_term: false })

// Con una estabilidad de 3 semanas o más se considera aprendida (igual sigue volviendo, cada vez más espaciada).
export const LEARNED_STABILITY = 21

export interface CardRow {
  id: number
  kind: CardKind
  source: string
  source_key: string
  topic_id: string | null
  subtopic_id: string | null
  front: string
  back: string
  payload: string | null
  given: string | null
  due_on: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: number
  last_review: string | null
  created_on: string
}

export interface NewCard {
  kind: CardKind
  source: string
  sourceKey: string
  topicId?: string | null
  subtopicId?: string | null
  front?: string
  back?: string
  payload?: unknown
  given?: unknown
  // Días hasta el primer repaso (por defecto, mañana).
  firstIn?: number
}

// Mediodía local de una fecha: así el cambio de horario nunca mueve el día.
const noon = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function toFsrs(row: CardRow): Card {
  return {
    due: noon(row.due_on),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? noon(row.last_review) : undefined
  }
}

// Anota una tarjeta nueva. Si ya existía (el mismo error o la misma palabra), no hace nada y devuelve null.
export function addCard(db: Db, card: NewCard, today: string): number | null {
  const json = (value: unknown): string | null => (value === undefined || value === null ? null : JSON.stringify(value))
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO cards (kind, source, source_key, topic_id, subtopic_id, front, back, payload, given, due_on, created_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      card.kind,
      card.source,
      card.sourceKey,
      card.topicId ?? null,
      card.subtopicId ?? null,
      card.front ?? '',
      card.back ?? '',
      json(card.payload),
      json(card.given),
      addDays(today, card.firstIn ?? 1),
      today
    )
  return result.changes > 0 ? Number(result.lastInsertRowid) : null
}

export function getCard(db: Db, id: number): CardRow | null {
  return (db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined) ?? null
}

export interface ReviewOutcome {
  dueOn: string
  intervalDays: number
  learned: boolean
  card: CardRow
}

// Registra un repaso y calcula cuándo vuelve.
export function reviewCard(db: Db, id: number, recall: Recall, today: string): ReviewOutcome {
  const row = getCard(db, id)
  if (!row) throw new Error('Esa tarjeta no existe.')
  const { card } = scheduler.next(toFsrs(row), noon(today), GRADE[recall])
  const dueOn = toLocalDate(card.due) > today ? toLocalDate(card.due) : addDays(today, 1)
  const intervalDays = Math.round((noon(dueOn).getTime() - noon(today).getTime()) / 86_400_000)
  db.prepare(`UPDATE cards SET due_on = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, state = ?, last_review = ? WHERE id = ?`).run(
    dueOn,
    card.stability,
    card.difficulty,
    card.reps,
    card.lapses,
    card.state,
    today,
    id
  )
  db.prepare('INSERT INTO card_reviews (card_id, day, rating, interval) VALUES (?, ?, ?, ?)').run(id, today, GRADE[recall], intervalDays)
  const updated = getCard(db, id)!
  return { dueOn, intervalDays, learned: isLearned(updated), card: updated }
}

export const isLearned = (row: Pick<CardRow, 'stability' | 'state'>): boolean => row.state === State.Review && row.stability >= LEARNED_STABILITY

// Qué tan firme está en la memoria, de 0 a 3, para mostrarlo como escalones.
// Sale de la estabilidad (cuántos días aguanta el recuerdo): después de un error baja sola.
export function strength(row: Pick<CardRow, 'stability' | 'state' | 'reps'>): number {
  if (row.reps === 0 || row.stability < 2) return 0
  if (row.stability < 7) return 1
  if (row.stability < LEARNED_STABILITY) return 2
  return 3
}

export const STRENGTH_STEPS = 4

export function dueCards(db: Db, kinds: CardKind[], today: string, limit: number): CardRow[] {
  const marks = kinds.map(() => '?').join(', ')
  return db
    .prepare(`SELECT * FROM cards WHERE kind IN (${marks}) AND due_on <= ? ORDER BY due_on, id LIMIT ?`)
    .all(...kinds, today, limit) as unknown as CardRow[]
}

export function countCards(db: Db, kinds: CardKind[], where = '1 = 1', ...args: (string | number)[]): number {
  const marks = kinds.map(() => '?').join(', ')
  return (db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE kind IN (${marks}) AND ${where}`).get(...kinds, ...args) as { n: number }).n
}

export function removeCard(db: Db, id: number): void {
  db.prepare('DELETE FROM cards WHERE id = ?').run(id)
}

// De qué tan bien salió una respuesta corregida a cómo se recuerda.
export function recallFrom(correct: boolean, score: number): Recall {
  if (!correct) return 'again'
  return score >= 10 ? 'good' : 'hard'
}
