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
    // Cada tópico de A1 aprobado un día distinto, con notas 8, 9 y 10 alternadas.
    const a1Topics = curriculum.filter((t) => t.level === 'A1')
    const grades = a1Topics.map((_, i) => 8 + (i % 3))
    const day = (i: number): string => `2026-10-${String(i + 1).padStart(2, '0')}`
    a1Topics.forEach((t, i) => insert.run(t.id, 'A1', grades[i], day(i)))
    insert.run(curriculum.find((t) => t.level === 'A2')!.id, 'A2', 9, '2026-10-28')

    const [a1, a2] = certificates(db, curriculum)
    const average = Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 10) / 10
    expect(a1).toMatchObject({ level: 'A1', complete: true, passedTopics: a1Topics.length, completedOn: day(a1Topics.length - 1), average })
    expect(a2).toMatchObject({ level: 'A2', complete: false, passedTopics: 1, completedOn: null })

    const html = certificateHtml(a1, 'pt', 'Juan <Pérez>')
    expect(html).toContain('Curso de portugués')
    expect(html).toContain('Juan &lt;Pérez&gt;')
    expect(html).toContain('A1 · Principiante')
  })
})
