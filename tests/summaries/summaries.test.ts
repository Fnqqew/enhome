import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { loadSettings } from '../../src/main/db/settings-repo'
import { Progression } from '../../src/main/engine/progression'
import { Summaries, type SummaryGenerator, type TextAsker } from '../../src/main/summaries/summaries'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const TODAY = '2026-09-14'

let db: Db
let progression: Progression
let summaries: Summaries
let calls: string[]
let questions: { fragment: string; question: string }[]

const generator: SummaryGenerator = async (topic, type) => {
  calls.push(`${topic.id}/${type}`)
  await new Promise((resolve) => setTimeout(resolve, 5))
  return type === 'tarjetas'
    ? { format: 'cards', cards: [{ front: 'f', back: 'b', example: 'e' }] }
    : { format: 'markdown', markdown: `## ${type} de ${topic.id} (versión ${calls.length})` }
}

const asker: TextAsker = async ({ fragment, question }) => {
  questions.push({ fragment, question })
  return 'Respuesta.'
}

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  summaries = new Summaries(db, curriculum, progression, generator, asker)
  calls = []
  questions = []
})

const startAtPresentSimple = (): void => progression.applyPlacementResult('a1-present-simple', [], '2026-09-13')

describe('acceso', () => {
  it('antes del examen inicial los resúmenes están bloqueados', () => {
    expect(summaries.getIndex(TODAY)).toMatchObject({ unlocked: false })
  })

  it('desbloquea el tópico en curso y los anteriores aprobados', () => {
    startAtPresentSimple()
    const index = summaries.getIndex(TODAY)
    if (!index.unlocked) throw new Error('se esperaba desbloqueado')
    expect(index.currentTopicId).toBe('a1-present-simple')
    expect(index.topics.map((t) => [t.id, t.status])).toEqual([
      ['a1-to-be', 'passed'],
      ['a1-nouns-articles', 'passed'],
      ['a1-present-simple', 'current']
    ])
  })

  it('no deja leer ni generar tópicos a los que no se llegó', async () => {
    startAtPresentSimple()
    expect(() => summaries.getSummary('a2-past-simple', 'completa', TODAY)).toThrow(/no llegaste/)
    await expect(summaries.generateSummary('a2-past-simple', 'esquema', false, TODAY)).rejects.toThrow(/no llegaste/)
  })
})

describe('resúmenes', () => {
  beforeEach(startAtPresentSimple)

  it('la explicación completa es el resumen base del temario', async () => {
    const view = summaries.getSummary('a1-to-be', 'completa', TODAY)
    expect(view.source).toBe('base')
    expect(view.content).toEqual({ format: 'markdown', markdown: curriculum[0].summary })
    await expect(summaries.generateSummary('a1-to-be', 'completa', false, TODAY)).rejects.toThrow(/ya viene con el temario/)
  })

  it('un tipo sin generar no tiene contenido', () => {
    expect(summaries.getSummary('a1-to-be', 'esquema', TODAY)).toMatchObject({ content: null, source: null })
  })

  it('genera una vez, guarda y reutiliza (también con pedidos simultáneos)', async () => {
    const [a, b] = await Promise.all([
      summaries.generateSummary('a1-to-be', 'esquema', false, TODAY),
      summaries.generateSummary('a1-to-be', 'esquema', false, TODAY)
    ])
    await summaries.generateSummary('a1-to-be', 'esquema', false, TODAY)
    expect(calls).toEqual(['a1-to-be/esquema'])
    expect(a.content).toEqual(b.content)
    expect(summaries.getSummary('a1-to-be', 'completa', TODAY).generatedTypes).toEqual(['esquema'])
  })

  it('regenerar reemplaza el contenido y borra la calificación', async () => {
    await summaries.generateSummary('a1-to-be', 'errores', false, TODAY)
    summaries.rate('a1-to-be', 'errores', 5, TODAY)
    const regenerated = await summaries.generateSummary('a1-to-be', 'errores', true, TODAY)
    expect(calls).toHaveLength(2)
    expect(regenerated.rating).toBeNull()
    expect(regenerated.content).toEqual({ format: 'markdown', markdown: '## errores de a1-to-be (versión 2)' })
  })

  it('guarda tarjetas de repaso', async () => {
    const view = await summaries.generateSummary('a1-to-be', 'tarjetas', false, TODAY)
    expect(view.content).toEqual({ format: 'cards', cards: [{ front: 'f', back: 'b', example: 'e' }] })
  })

  it('califica el resumen base y los generados', async () => {
    expect(summaries.rate('a1-to-be', 'completa', 5, TODAY).rating).toBe(5)
    expect(() => summaries.rate('a1-to-be', 'esquema', 3, TODAY)).toThrow(/Primero/)
    await summaries.generateSummary('a1-to-be', 'esquema', false, TODAY)
    expect(summaries.rate('a1-to-be', 'esquema', 3, TODAY).rating).toBe(3)
    // Calificar el base no lo convierte en generado ni pisa su contenido.
    expect(summaries.getSummary('a1-to-be', 'completa', TODAY).content).toEqual({ format: 'markdown', markdown: curriculum[0].summary })
  })
})

describe('orden de tipos', () => {
  beforeEach(startAtPresentSimple)

  const order = (): string[] => {
    const index = summaries.getIndex(TODAY)
    if (!index.unlocked) throw new Error('se esperaba desbloqueado')
    return index.types.map((t) => t.id)
  }

  it('la explicación completa siempre primero, después favoritos y mejor calificados', async () => {
    expect(order().slice(0, 2)).toEqual(['completa', 'esquema'])

    await summaries.generateSummary('a1-to-be', 'trucos', false, TODAY)
    summaries.rate('a1-to-be', 'trucos', 5, TODAY)
    summaries.setFavorite('dialogo', true, TODAY)

    expect(order().slice(0, 3)).toEqual(['completa', 'dialogo', 'trucos'])
    const index = summaries.getIndex(TODAY)
    if (!index.unlocked) throw new Error()
    expect(index.types.find((t) => t.id === 'trucos')).toMatchObject({ recommended: true, averageRating: 5 })
    expect(loadSettings(db).favoriteSummaryTypes).toEqual(['dialogo'])

    summaries.setFavorite('dialogo', false, TODAY)
    expect(order()[1]).toBe('trucos')
  })
})

describe('preguntar sobre un texto', () => {
  beforeEach(startAtPresentSimple)

  it('usa una pregunta por defecto si viene vacía', async () => {
    expect(await summaries.ask('a1-to-be', '  I am not tired.  ', '', TODAY)).toEqual({ answer: 'Respuesta.' })
    expect(questions[0]).toEqual({ fragment: 'I am not tired.', question: 'Explicame esto con otras palabras y con un ejemplo.' })
  })

  it('valida el fragmento y el acceso al tópico', async () => {
    await expect(summaries.ask('a1-to-be', '   ', 'hola', TODAY)).rejects.toThrow(/Seleccioná/)
    await expect(summaries.ask('a1-to-be', 'x'.repeat(2001), 'hola', TODAY)).rejects.toThrow(/largo/)
    await expect(summaries.ask('a2-past-simple', 'texto', 'hola', TODAY)).rejects.toThrow(/no llegaste/)
  })
})
