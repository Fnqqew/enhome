import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { LANGUAGE_IDS } from '../src/shared/languages'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CurriculumError, loadCurriculum, validateCurriculum } from '../src/main/content/curriculum'
import type { CurriculumTopic, Topic } from '../src/shared/curriculum'

const CONTENT_DIR = join(__dirname, '..', 'content')

function makeTopic(overrides: Partial<CurriculumTopic> = {}): CurriculumTopic {
  const topic: Topic = {
    id: 'a1-prueba',
    level: 'A1',
    order: 1,
    title: 'Prueba',
    targetTitle: 'Test',
    description: 'Tópico de prueba.',
    objectives: ['Probar'],
    prerequisites: [],
    reviewed: false,
    subtopics: [1, 2, 3, 4, 5].map((day) => ({
      id: `sub-${day}`,
      day,
      title: `Subtema ${day}`,
      goal: 'Objetivo',
      focus: ['grammar'],
      keyPoints: ['Punto'],
      examples: [
        { target: 'Hello', es: 'Hola' },
        { target: 'Bye', es: 'Chau' }
      ],
      commonMistakes: []
    }))
  }
  const summary = [1, 2, 3, 4, 5].map((d) => `## Día ${d} — Subtema ${d}\n\nTexto.`).join('\n\n')
  return { ...topic, language: 'en', summary, ...overrides }
}

// Cada idioma con contenido se valida entero: formato, orden, prerrequisitos y resumen por día.
const COURSES = LANGUAGE_IDS.filter((language) => existsSync(join(CONTENT_DIR, language, 'A1')))

describe.each(COURSES)('temario real de %s (content/)', (language) => {
  // Se carga dentro de cada prueba: con -t "temario real de it" se valida un solo idioma.
  let loaded: CurriculumTopic[] | null = null
  const load = (): CurriculumTopic[] => (loaded ??= loadCurriculum(CONTENT_DIR, language))

  it('carga los tópicos de A1 y A2 sin errores', () => {
    expect(load().filter((t) => t.level === 'A1').length).toBeGreaterThanOrEqual(5)
    expect(load().filter((t) => t.level === 'A2').length).toBeGreaterThanOrEqual(5)
  })

  it('queda ordenado por nivel y orden', () => {
    const keys = load().map((t) => `${t.level}-${String(t.order).padStart(2, '0')}`)
    expect(keys).toEqual([...keys].sort())
  })

  it('tiene al menos dos ejemplos por subtema', () => {
    for (const topic of load()) {
      for (const sub of topic.subtopics) expect(sub.examples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('todos los tópicos son del idioma del curso', () => {
    for (const topic of load()) {
      expect(topic.language).toBe(language)
      if (language !== 'en') expect(topic.id.startsWith(`${language}-`)).toBe(true)
    }
  })
})

describe('validateCurriculum', () => {
  it('acepta un tópico válido', () => {
    expect(() => validateCurriculum([makeTopic()])).not.toThrow()
  })

  it('detecta ids repetidos', () => {
    expect(() => validateCurriculum([makeTopic(), makeTopic({ order: 2 })])).toThrow(/repetido/)
  })

  it('detecta saltos en el orden', () => {
    expect(() => validateCurriculum([makeTopic({ order: 2 })])).toThrow(/orden/)
  })

  it('detecta prerrequisitos inexistentes o posteriores', () => {
    expect(() => validateCurriculum([makeTopic({ prerequisites: ['no-existe'] })])).toThrow(/no existe/)
    const first = makeTopic({ prerequisites: ['a1-segundo'] })
    const second = makeTopic({ id: 'a1-segundo', order: 2 })
    expect(() => validateCurriculum([first, second])).toThrow(/tiene que estar antes/)
  })

  it('exige una sección por día en el resumen', () => {
    const topic = makeTopic()
    expect(() => validateCurriculum([{ ...topic, summary: topic.summary.replace('## Día 3', '## Tres') }])).toThrow(/Día 3/)
  })
})

describe('loadCurriculum', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  function writeTopic(folder: string, topic: object, summary?: string): void {
    const topicDir = join(dir!, folder)
    mkdirSync(topicDir, { recursive: true })
    writeFileSync(join(topicDir, 'topic.json'), JSON.stringify(topic))
    if (summary !== undefined) writeFileSync(join(topicDir, 'resumen.md'), summary)
  }

  it('informa la carpeta cuando un topic.json es inválido', () => {
    dir = mkdtempSync(join(tmpdir(), 'curriculum-'))
    const { summary, language: _language, ...topic } = makeTopic()
    writeTopic('en/A1/01-prueba', { ...topic, title: '' }, summary)
    expect(() => loadCurriculum(dir!)).toThrow(CurriculumError)
    expect(() => loadCurriculum(dir!)).toThrow(/A1\/01-prueba/)
  })

  it('detecta un nivel que no coincide con la carpeta', () => {
    dir = mkdtempSync(join(tmpdir(), 'curriculum-'))
    const { summary, language: _language, ...topic } = makeTopic({ level: 'A2' })
    writeTopic('en/A1/01-prueba', topic, summary)
    expect(() => loadCurriculum(dir!)).toThrow(/carpeta A1/)
  })

  it('exige resumen.md', () => {
    dir = mkdtempSync(join(tmpdir(), 'curriculum-'))
    const { summary: _summary, language: _language, ...topic } = makeTopic()
    writeTopic('en/A1/01-prueba', topic)
    expect(() => loadCurriculum(dir!)).toThrow(/resumen\.md/)
  })
})
