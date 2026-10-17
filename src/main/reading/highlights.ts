// Resaltados del modo lectura: fragmentos marcados de un resumen o una lectura, con una nota.

import type { Highlight } from '../../shared/reading'
import type { Db } from '../db/database'

export const MAX_HIGHLIGHT = 600
export const MAX_NOTE = 1000

const view = (r: { id: number; text: string; note: string }): Highlight => ({ id: r.id, text: r.text, note: r.note })

export function listHighlights(db: Db, docKey: string): Highlight[] {
  return (db.prepare('SELECT id, text, note FROM highlights WHERE doc_key = ? ORDER BY id').all(docKey) as unknown as Highlight[]).map(view)
}

export function addHighlight(db: Db, docKey: string, text: string): Highlight[] {
  const clean = text.trim().slice(0, MAX_HIGHLIGHT)
  const exists = db.prepare('SELECT 1 FROM highlights WHERE doc_key = ? AND text = ?').get(docKey, clean)
  if (clean && !exists) db.prepare('INSERT INTO highlights (doc_key, text) VALUES (?, ?)').run(docKey, clean)
  return listHighlights(db, docKey)
}

export function updateHighlightNote(db: Db, id: number, note: string): void {
  db.prepare('UPDATE highlights SET note = ? WHERE id = ?').run(note.slice(0, MAX_NOTE), id)
}

export function removeHighlight(db: Db, docKey: string, id: number): Highlight[] {
  db.prepare('DELETE FROM highlights WHERE id = ?').run(id)
  return listHighlights(db, docKey)
}
