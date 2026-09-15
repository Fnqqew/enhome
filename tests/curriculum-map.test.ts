import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum, loadRoadmap } from '../src/main/content/curriculum'
import { buildCurriculumMap } from '../src/main/content/curriculum-map'

const CONTENT_DIR = join(__dirname, '..', 'content')
const curriculum = loadCurriculum(CONTENT_DIR)
const roadmap = loadRoadmap(CONTENT_DIR)

describe('roadmap', () => {
  it('planifica B1 y B2', () => {
    expect(roadmap.levels.map((l) => l.level)).toEqual(['B1', 'B2'])
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
    const map = buildCurriculumMap(curriculum, roadmap, new Map(), null, false)
    const b1 = map.levels.find((l) => l.level === 'B1')!
    expect(b1.available).toBe(false)
    expect(b1.planned.length).toBeGreaterThan(0)
    expect(map.levels.find((l) => l.level === 'A1')?.available).toBe(true)
    expect('summary' in map.levels[0].topics[0]).toBe(false)
  })
})
