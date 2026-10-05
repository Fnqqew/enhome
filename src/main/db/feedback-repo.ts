// Los comentarios del usuario viven solo en su base; nunca salen de la computadora.

import type { FeedbackNote, NewFeedback } from '../../shared/feedback'
import type { SectionId } from '../../shared/sections'
import type { Db } from './database'

interface Row {
  id: number
  kind: FeedbackNote['kind']
  section: string
  message: string
  done: number
  created_at: string
}

const toNote = (row: Row): FeedbackNote => ({
  id: row.id,
  kind: row.kind,
  section: row.section as SectionId | 'general',
  message: row.message,
  done: row.done === 1,
  createdAt: row.created_at
})

export function listFeedback(db: Db): FeedbackNote[] {
  const rows = db.prepare('SELECT * FROM feedback ORDER BY done, id DESC').all() as unknown as Row[]
  return rows.map(toNote)
}

export function addFeedback(db: Db, note: NewFeedback): FeedbackNote[] {
  db.prepare('INSERT INTO feedback (kind, section, message) VALUES (?, ?, ?)').run(note.kind, note.section, note.message)
  return listFeedback(db)
}

export function toggleFeedback(db: Db, id: number): FeedbackNote[] {
  db.prepare('UPDATE feedback SET done = 1 - done WHERE id = ?').run(id)
  return listFeedback(db)
}

export function removeFeedback(db: Db, id: number): FeedbackNote[] {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(id)
  return listFeedback(db)
}
