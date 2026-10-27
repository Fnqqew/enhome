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
  questions: Array.from({ length: 4 }, (_, i) => ({
    prompt: `Pregunta ${i}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: i % 4,
    explanation: 'Porque sí.'
  }))
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

describe('la historia de la semana', () => {
  // La semana del primer tópico empieza el lunes 19/10.
  const MON = '2026-10-19'

  it('un capítulo por día, con los anteriores en el pedido, y no más adelante que las prácticas hechas', async () => {
    const prompts: string[] = []
    const ask = (async (options: { prompt: string }) => {
      prompts.push(options.prompt)
      return story
    }) as unknown as Ask
    progression.applyPlacementResult(curriculum[0].id, [], addDays(MON, -1))
    const readings = new Readings(db, curriculum, progression, 'it', ask)
    const week = progression.getState(MON).week!
    expect(readings.story(MON)).toMatchObject({ chapters: [], next: { chapter: 1, subtopicTitle: curriculum[0].subtopics[0].title } })

    const first = await readings.nextChapter(MON)
    expect(first.chapter).toBe(1)
    expect(readings.story(MON)).toMatchObject({ next: null, waitReason: expect.stringMatching(/Mañana/) })
    await expect(readings.nextChapter(MON)).rejects.toThrow(/Mañana/)

    // Al otro día sin haber practicado, hay que hacer la práctica primero.
    const tomorrow = addDays(MON, 1)
    expect(readings.story(tomorrow)?.waitReason).toMatch(/práctica/)

    // Con la práctica del día hecha, sigue con el capítulo 2, que lleva el 1 en el pedido.
    progression.completeUnit(week.units[0].id, tomorrow)
    expect(readings.story(tomorrow)?.next?.chapter).toBe(2)
    await readings.nextChapter(tomorrow)
    expect(prompts[1]).toContain(`Capítulo 1: ${story.title}`)
    expect(readings.list()[0]).toMatchObject({ chapter: 2 })
  })
})
