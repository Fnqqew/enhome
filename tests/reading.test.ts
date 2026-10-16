import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../src/main/claude/bridge'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase, type Db } from '../src/main/db/database'
import { Progression } from '../src/main/engine/progression'
import { buildJournalPrompt, Journal } from '../src/main/reading/journal'
import { buildReadingPrompt, Readings } from '../src/main/reading/readings'
import { addDays } from '../src/shared/dates'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'), 'it')
const TODAY = '2026-10-16'

const story = {
  title: 'Una giornata strana',
  text: 'Marco si sveglia tardi.\n\nPrende il treno e arriva in ufficio alle dieci. Il capo è arrabbiato, ma poi ride.',
  glossary: [
    { term: 'si sveglia', translation: 'se despierta' },
    { term: 'treno', translation: 'tren' },
    { term: 'arrabbiato', translation: 'enojado' },
    { term: 'inesistente', translation: 'no está en el texto' }
  ],
  questions: Array.from({ length: 4 }, (_, i) => ({ prompt: `Pregunta ${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: i % 4, explanation: 'Porque sí.' }))
}
const review = { correctedText: 'Oggi sono andato al mare.', comments: 'Muy bien.', mistakes: [], tip: 'fare un tuffo (darse un chapuzón)', score: 8 }

let db: Db
let progression: Progression

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
})

describe('lecturas graduadas', () => {
  it('guarda la lectura y deja en el glosario solo lo que aparece en el texto', async () => {
    const readings = new Readings(db, curriculum, progression, 'it', (async () => story) as unknown as Ask)
    const reading = await readings.generate('Humor', TODAY)
    expect(reading.glossary.map((g) => g.term)).toEqual(['si sveglia', 'treno', 'arrabbiato'])
    expect(readings.list()).toHaveLength(1)

    const answered = readings.answer(reading.id, [0, 1, 0, 0])
    expect(answered.score).toBe(5)
    expect(answered.answers).toEqual([0, 1, 0, 0])
  })

  it('pide la extensión del nivel y usa el tópico de la semana', () => {
    const prompt = buildReadingPrompt(curriculum[0], curriculum.slice(0, 1), 'Viajes')
    expect(prompt).toContain('entre 110 y 170 palabras')
    expect(prompt).toContain(curriculum[0].title)
    expect(prompt).toContain('italiano')
  })
})

describe('diario', () => {
  it('guarda el borrador, lo corrige y cuenta los días seguidos', async () => {
    const journal = new Journal(db, curriculum, progression, 'it', (async () => review) as unknown as Ask)
    journal.save('Ieri ho mangiato la pizza con mia sorella.', addDays(TODAY, -1))
    journal.save('Oggi sono andato al mare con i miei amici.', TODAY)
    const corrected = await journal.correct(TODAY)
    expect(corrected.today).toMatchObject({ review: { score: 8 }, edited: false })
    expect(corrected.streak).toBe(2)
    expect(corrected.past).toHaveLength(1)

    const edited = journal.save('Oggi sono andato al mare con i miei amici e mia madre.', TODAY)
    expect(edited.today?.edited).toBe(true)
  })

  it('no corrige un texto vacío o de una palabra', async () => {
    const journal = new Journal(db, curriculum, progression, 'it', (async () => review) as unknown as Ask)
    journal.save('Ciao', TODAY)
    await expect(journal.correct(TODAY)).rejects.toThrow(/al menos/)
  })

  it('el pedido incluye el nivel y el tópico', () => {
    const prompt = buildJournalPrompt('Oggi sono stanco.', curriculum[0])
    expect(prompt).toContain(`nivel ${curriculum[0].level}`)
    expect(prompt).toContain(curriculum[0].title)
  })
})
