import { mkdtempSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { applyTopicReviews, saveTopicReview, writeTopicFiles } from '../src/main/content/topic-reviews'
import { openDatabase, type Db } from '../src/main/db/database'

const CONTENT = join(__dirname, '..', 'content')
const curriculum = loadCurriculum(CONTENT, 'fr')
const first = curriculum[0]
const TODAY = '2026-10-16'

const editOf = (patch: Partial<typeof first> = {}) => {
  const { language: _language, summary, ...topic } = { ...first, ...patch }
  return { topic, summary }
}

let db: Db
beforeEach(() => {
  db = openDatabase(':memory:')
})

describe('revisión de tópicos desde la app', () => {
  it('guarda lo corregido, lo marca como revisado y lo aplica al cargar', () => {
    saveTopicReview(db, curriculum, first.id, editOf({ title: 'Ser, estar y tener (revisado)' }), true, TODAY)
    const applied = applyTopicReviews(curriculum, db)
    expect(applied[0]).toMatchObject({ id: first.id, title: 'Ser, estar y tener (revisado)', reviewed: true })
    expect(applied[1]).toBe(curriculum[1])
  })

  it('no deja cambiar el id, el nivel ni el orden', () => {
    const saved = saveTopicReview(db, curriculum, first.id, editOf({ id: 'otro', level: 'B2', order: 9 }), false, TODAY)
    expect(saved).toMatchObject({ id: first.id, level: first.level, order: first.order, reviewed: false })
  })

  it('rechaza un resumen sin las secciones de cada día', () => {
    expect(() => saveTopicReview(db, curriculum, first.id, { ...editOf(), summary: '# Sin días' }, true, TODAY)).toThrow(/Día 1/)
  })

  it('rechaza un subtema sin ejemplos suficientes', () => {
    const broken = editOf()
    broken.topic.subtopics = broken.topic.subtopics.map((s, i) => (i === 0 ? { ...s, examples: [] } : s))
    expect(() => saveTopicReview(db, curriculum, first.id, broken, true, TODAY)).toThrow(/problema/)
  })
})

describe('escritura en content/ (desarrollo)', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'enhome-content-'))
    cpSync(join(CONTENT, 'fr'), join(dir, 'fr'), { recursive: true })
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('escribe topic.json y resumen.md en la carpeta del tópico', () => {
    const saved = saveTopicReview(db, curriculum, first.id, editOf({ description: 'Nueva descripción.' }), true, TODAY)
    expect(writeTopicFiles(dir, 'fr', saved)).toBe(true)
    const reloaded = loadCurriculum(dir, 'fr')
    expect(reloaded[0]).toMatchObject({ description: 'Nueva descripción.', reviewed: true })
    expect(readFileSync(join(dir, 'fr', 'A1', '01-etre-avoir', 'resumen.md'), 'utf8')).toBe(saved.summary)
  })
})
