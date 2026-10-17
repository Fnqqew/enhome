// Biblioteca: todo lo generado del curso (resúmenes, lecturas, vocabulario y diario) en un solo lugar.

import type { CurriculumTopic } from '../../shared/curriculum'
import type { LibraryItem } from '../../shared/library'
import { SUMMARY_TYPES, type SummaryContent, type SummaryTypeId } from '../../shared/summaries'
import type { Db } from '../db/database'

const fold = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// El fragmento donde aparece lo buscado (o el principio del texto).
function snippet(text: string, query: string): string {
  const clean = text
    .replace(/[#*_>|`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const at = query ? fold(clean).indexOf(fold(query)) : -1
  const start = Math.max(0, at - 60)
  const piece = clean.slice(start, start + 200)
  return `${start > 0 ? '…' : ''}${piece}${start + 200 < clean.length ? '…' : ''}`
}

export function libraryItems(db: Db, curriculum: CurriculumTopic[]): LibraryItem[] {
  const titles = new Map(curriculum.map((t) => [t.id, t.title]))
  const items: LibraryItem[] = []

  const summaries = db
    .prepare("SELECT id, topic_id, type, content, created_at FROM summaries WHERE source = 'ai' AND content <> ''")
    .all() as unknown as { id: number; topic_id: string; type: SummaryTypeId; content: string; created_at: string }[]
  for (const s of summaries) {
    const content = JSON.parse(s.content) as SummaryContent
    const text = content.format === 'markdown' ? content.markdown : content.cards.map((c) => `${c.front} — ${c.back}`).join('\n')
    items.push({
      kind: 'resumen',
      id: `resumen:${s.id}`,
      title: `${SUMMARY_TYPES[s.type]?.label ?? s.type} · ${titles.get(s.topic_id) ?? s.topic_id}`,
      date: s.created_at.slice(0, 10),
      text,
      markdown: content.format === 'markdown'
    })
  }

  const readings = db.prepare('SELECT id, title, content, created_on FROM readings').all() as unknown as {
    id: number
    title: string
    content: string
    created_on: string
  }[]
  for (const r of readings) {
    items.push({
      kind: 'lectura',
      id: `lectura:${r.id}`,
      title: r.title,
      date: r.created_on,
      text: (JSON.parse(r.content) as { text: string }).text,
      markdown: false
    })
  }

  const words = db.prepare('SELECT id, term, translation, example, example_es, note, created_on FROM vocab').all() as unknown as {
    id: number
    term: string
    translation: string
    example: string | null
    example_es: string | null
    note: string | null
    created_on: string
  }[]
  for (const w of words) {
    items.push({
      kind: 'palabra',
      id: `palabra:${w.id}`,
      title: `${w.term} — ${w.translation}`,
      date: w.created_on,
      text: [w.example, w.example_es, w.note].filter(Boolean).join('\n'),
      markdown: false
    })
  }

  const entries = db.prepare('SELECT day, text, review FROM journal').all() as unknown as { day: string; text: string; review: string | null }[]
  for (const e of entries) {
    const corrected = e.review ? (JSON.parse(e.review) as { correctedText?: string }).correctedText : null
    items.push({
      kind: 'diario',
      id: `diario:${e.day}`,
      title: `Diario del ${e.day.slice(8)}/${e.day.slice(5, 7)}`,
      date: e.day,
      text: corrected ? `${e.text}\n\nCorregido:\n${corrected}` : e.text,
      markdown: false
    })
  }

  return items.sort((a, b) => b.date.localeCompare(a.date))
}

export function searchLibrary(db: Db, curriculum: CurriculumTopic[], query: string): (LibraryItem & { snippet: string })[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return libraryItems(db, curriculum)
    .filter((item) => words.every((w) => fold(`${item.title} ${item.text}`).includes(w)))
    .slice(0, 80)
    .map((item) => ({ ...item, snippet: snippet(item.text, words[0] ?? '') }))
}
