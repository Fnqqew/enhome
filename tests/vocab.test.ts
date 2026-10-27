import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../src/main/claude/bridge'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase, type Db } from '../src/main/db/database'
import { buildLookupPrompt, Vocabulary } from '../src/main/vocab/vocab'
import { CoreVocabulary } from '../src/main/vocab/core'
import type { CoreWord } from '../src/shared/core-vocab'
import { addDays } from '../src/shared/dates'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'), 'pt')
const TODAY = '2026-10-16'

const word = {
  term: 'emprestar',
  translation: 'prestar',
  example: 'Pode me emprestar a caneta?',
  exampleEs: '¿Me prestás la lapicera?',
  note: 'Falso amigo: no es «pedir prestado».'
}
const fakeAsk = (async () => word) as unknown as Ask

let db: Db
let vocab: Vocabulary

beforeEach(() => {
  db = openDatabase(':memory:')
  vocab = new Vocabulary(db, curriculum, 'pt', fakeAsk)
})

describe('vocabulario', () => {
  it('traduce sin guardar y avisa si ya estaba', async () => {
    expect(await vocab.lookup('empresta', 'Você me empresta?', 'A2')).toMatchObject({ term: 'emprestar', saved: false })
    vocab.save(word, TODAY)
    expect(await vocab.lookup('emprestou', '', 'A2')).toMatchObject({ saved: true })
  })

  it('guarda una sola vez sin importar mayúsculas', () => {
    vocab.save(word, TODAY)
    const overview = vocab.save({ ...word, term: 'Emprestar' }, TODAY)
    expect(overview.cards).toHaveLength(1)
    expect(overview.dueToday).toBe(0)
  })

  it('las tarjetas avanzan si te la sabías y vuelven mañana si no', () => {
    const { cards } = vocab.save(word, TODAY)
    const day = addDays(TODAY, 1)
    expect(vocab.due(day)).toHaveLength(1)
    const knew = vocab.review(cards[0].id, true, day)
    expect(knew.stage).toBeGreaterThan(0)
    expect(knew.dueOn > addDays(day, 1)).toBe(true)
    expect(vocab.review(cards[0].id, false, knew.dueOn)).toMatchObject({ stage: 0, dueOn: addDays(knew.dueOn, 1) })
  })

  it('se puede borrar', () => {
    const { cards } = vocab.save(word, TODAY)
    expect(vocab.remove(cards[0].id, TODAY).cards).toHaveLength(0)
  })

  it('el pedido a Claude es en el idioma del curso y con el contexto', () => {
    const prompt = buildLookupPrompt('empresta', 'Você me empresta a caneta?', 'pt', 'A2')
    expect(prompt).toContain('portugués de Brasil')
    expect(prompt).toContain('Você me empresta a caneta?')
  })
})

describe('oraciones guardadas de una lectura', () => {
  it('se guardan enteras con la traducción de Claude, una sola vez, y vuelven con las tarjetas', async () => {
    const prompts: string[] = []
    const ask = (async (options: { prompt: string }) => {
      prompts.push(options.prompt)
      return { translation: 'Mañana voy a la playa con mis amigos.' }
    }) as unknown as Ask
    const reader = new Vocabulary(db, curriculum, 'pt', ask)
    const sentence = 'Amanhã  vou à praia com os meus amigos.'
    await reader.saveSentence(sentence, TODAY)
    const overview = await reader.saveSentence(sentence, TODAY)
    expect(overview.cards).toHaveLength(1)
    expect(overview.cards[0]).toMatchObject({
      kind: 'sentence',
      term: 'Amanhã vou à praia com os meus amigos.',
      translation: 'Mañana voy a la playa con mis amigos.'
    })
    expect(prompts[0]).toContain('portugués')
    expect(reader.due(addDays(TODAY, 1)).map((c) => c.kind)).toEqual(['sentence'])
  })
})

describe('vocabulario núcleo', () => {
  const core = (term: string, level: 'A1' | 'A2' = 'A1'): CoreWord => ({
    term,
    es: `es-${term}`,
    level,
    theme: 'casa',
    example: `${term}.`,
    exampleEs: '.'
  })

  it('propone las siguientes del nivel en orden de frecuencia, sin las que ya están en las tarjetas', () => {
    const words = [...Array.from({ length: 10 }, (_, i) => core(`a1-${i}`)), core('a2-0', 'A2')]
    const vocabulary = new CoreVocabulary(db, words)
    vocab.save({ term: 'a1-0', translation: 'x', example: '', exampleEs: '', note: '' }, TODAY)

    const today = vocabulary.today('A1')
    expect(today.words.map((w) => w.term)).toEqual(['a1-1', 'a1-2', 'a1-3', 'a1-4', 'a1-5', 'a1-6', 'a1-7', 'a1-8'])
    expect(today).toMatchObject({ learned: 1, total: 10 })

    const after = vocabulary.learn(
      today.words.map((w) => w.term),
      'A1',
      TODAY
    )
    expect(after.words.map((w) => w.term)).toEqual(['a1-9'])
    expect(vocab.overview(TODAY).cards).toHaveLength(9)
  })
})
