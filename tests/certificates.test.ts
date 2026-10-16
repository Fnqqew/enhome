import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase } from '../src/main/db/database'
import { certificateHtml, certificates } from '../src/main/rewards/certificates'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'), 'pt')

describe('certificados de nivel', () => {
  it('un nivel queda completo al aprobar todos sus tópicos', () => {
    const db = openDatabase(':memory:')
    const insert = db.prepare("INSERT INTO topic_progress (topic_id, cefr_level, status, best_grade, passed_at) VALUES (?, ?, 'passed', ?, ?)")
    curriculum
      .filter((t) => t.level === 'A1')
      .forEach((t, i) => insert.run(t.id, 'A1', 8 + (i % 3), `2026-10-0${i + 1}`))
    insert.run(curriculum.find((t) => t.level === 'A2')!.id, 'A2', 9, '2026-10-08')

    const [a1, a2] = certificates(db, curriculum)
    expect(a1).toMatchObject({ level: 'A1', complete: true, passedTopics: 5, completedOn: '2026-10-05', average: 8.8 })
    expect(a2).toMatchObject({ level: 'A2', complete: false, passedTopics: 1, completedOn: null })

    const html = certificateHtml(a1, 'pt', 'Juan <Pérez>')
    expect(html).toContain('Curso de portugués')
    expect(html).toContain('Juan &lt;Pérez&gt;')
    expect(html).toContain('A1 · Principiante')
  })
})
