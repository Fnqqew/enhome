import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum, loadRoadmap } from '../src/main/content/curriculum'
import { buildCurriculumMap } from '../src/main/content/curriculum-map'
import type { Roadmap } from '../src/shared/curriculum'
import { LANGUAGE_IDS } from '../src/shared/languages'

const CONTENT_DIR = join(__dirname, '..', 'content')
const curriculum = loadCurriculum(CONTENT_DIR)
const roadmap = loadRoadmap(CONTENT_DIR)

describe('roadmap', () => {
  it('cada curso tiene contenido de A1 a C1 (y C2 a medida que se escribe), así que no queda nada planificado', () => {
    for (const language of LANGUAGE_IDS) {
      expect(loadRoadmap(CONTENT_DIR, language).levels).toEqual([])
      const levels = new Set(loadCurriculum(CONTENT_DIR, language).map((t) => t.level))
      for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) expect(levels).toContain(level)
    }
  })
})

describe('buildCurriculumMap', () => {
  it('antes del examen inicial todo figura sin empezar', () => {
    const map = buildCurriculumMap(curriculum, roadmap, new Map(), null, false)
    expect(map.levels.flatMap((l) => l.topics).every((t) => t.status === 'not-started')).toBe(true)
  })

  it('marca el tópico en curso, los aprobados, los de repaso y los bloqueados', () => {
    const progress = new Map([
      ['a1-to-be', { status: 'passed', bestGrade: 9, attempts: 1 }],
      ['a1-nouns-articles', { status: 'review', bestGrade: null, attempts: 0 }],
      ['a1-present-simple', { status: 'in_progress', bestGrade: null, attempts: 0 }]
    ])
    const map = buildCurriculumMap(curriculum, roadmap, progress, 'a1-present-simple', true)
    const status = Object.fromEntries(map.levels.flatMap((l) => l.topics).map((t) => [t.id, t.status]))
    expect(status['a1-to-be']).toBe('passed')
    expect(status['a1-nouns-articles']).toBe('review')
    expect(status['a1-present-simple']).toBe('current')
    expect(status['a2-past-simple']).toBe('locked')
    expect(map.levels[0].topics[0].bestGrade).toBe(9)
  })

  it('incluye niveles futuros con sus tópicos planificados y sin el resumen pesado', () => {
    // Un curso que solo tiene A1 y A2, con B1 planificado.
    const planned: Roadmap = { levels: [{ level: 'B1', topics: [{ title: 'Pasado continuo', description: 'Historias.' }] }] }
    const basics = curriculum.filter((t) => t.level === 'A1' || t.level === 'A2')
    const map = buildCurriculumMap(basics, planned, new Map(), null, false)
    const b1 = map.levels.find((l) => l.level === 'B1')!
    expect(b1.available).toBe(false)
    expect(b1.planned.length).toBeGreaterThan(0)
    expect(map.levels.find((l) => l.level === 'A1')?.available).toBe(true)
    expect('summary' in map.levels[0].topics[0]).toBe(false)
  })
})
