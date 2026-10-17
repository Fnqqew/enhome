import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../src/main/claude/bridge'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase, type Db } from '../src/main/db/database'
import { buildLookupPrompt, Vocabulary } from '../src/main/vocab/vocab'
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
    expect(vocab.review(cards[0].id, true, day)).toMatchObject({ stage: 1, dueOn: addDays(day, 3) })
    expect(vocab.review(cards[0].id, false, day)).toMatchObject({ stage: 0, dueOn: addDays(day, 1) })
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
