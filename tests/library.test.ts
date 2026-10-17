import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase } from '../src/main/db/database'
import { searchLibrary } from '../src/main/library/library'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'))

describe('biblioteca', () => {
  it('junta resúmenes, lecturas, palabras y diario, y busca sin importar tildes', () => {
    const db = openDatabase(':memory:')
    db.prepare("INSERT INTO summaries (topic_id, type, content, source, created_at) VALUES (?, 'mini-historia', ?, 'ai', '2026-10-10 10:00:00')").run(
      curriculum[0].id,
      JSON.stringify({ format: 'markdown', markdown: '# Historia\n\nAna is a **teacher** in Córdoba.' })
    )
    db.prepare("INSERT INTO readings (level, title, content, created_on) VALUES ('A1', 'A day in London', ?, '2026-10-12')").run(
      JSON.stringify({ text: 'Tom wakes up early.', glossary: [], questions: [] })
    )
    db.prepare("INSERT INTO vocab (term, translation, due_on, created_on) VALUES ('wake up', 'despertarse', '2026-10-13', '2026-10-12')").run()
    db.prepare("INSERT INTO journal (day, text) VALUES ('2026-10-14', 'Today I went to Cordoba.')").run()

    const all = searchLibrary(db, curriculum, '')
    expect(all.map((r) => r.kind)).toEqual(['diario', 'lectura', 'palabra', 'resumen'])

    const cordoba = searchLibrary(db, curriculum, 'cordoba')
    expect(cordoba.map((r) => r.kind).sort()).toEqual(['diario', 'resumen'])
    expect(cordoba.find((r) => r.kind === 'resumen')?.snippet).toContain('Córdoba')
    expect(searchLibrary(db, curriculum, 'wake').map((r) => r.kind).sort()).toEqual(['lectura', 'palabra'])
  })
})
