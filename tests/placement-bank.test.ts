import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { loadPlacementBank, withPlacementBank } from '../src/main/content/placement-bank'
import { PLACEMENT_QUESTIONS_PER_TOPIC } from '../src/main/engine/rules'
import { LANGUAGE_IDS } from '../src/shared/languages'

const CONTENT = join(__dirname, '..', 'content')
const WITH_BANK = LANGUAGE_IDS.filter((language) => existsSync(join(CONTENT, language, 'placement.json')))

describe.each(WITH_BANK)('banco del examen inicial de %s', (language) => {
  const curriculum = loadCurriculum(CONTENT, language)
  const bank = loadPlacementBank(CONTENT, language, curriculum)

  it('cubre todos los tópicos de A1 y A2', () => {
    const basics = curriculum.filter((t) => t.level === 'A1' || t.level === 'A2')
    expect(basics.filter((t) => !bank.has(t.id)).map((t) => t.id)).toEqual([])
  })

  it('cada pregunta tiene la opción correcta dentro de la consigna y sin pistas obvias', () => {
    for (const questions of bank.values()) {
      for (const q of questions) {
        expect(q.options[q.correctIndex]).toBeTruthy()
        // Una opción que es la oración entera repetida delata la respuesta.
        expect(q.options.every((o) => o.length < q.prompt.length + 40)).toBe(true)
      }
    }
  })
})

describe('withPlacementBank', () => {
  const curriculum = loadCurriculum(CONTENT, 'en')
  const topic = curriculum[0]
  const question = (subtopicId: string, n: number) => ({
    subtopicId,
    instruction: 'Elegí.',
    prompt: `Pregunta ${n} ___`,
    options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
    correctIndex: 0,
    explanation: 'Porque sí.'
  })

  it('usa el banco sin llamar a Claude y elige subtemas distintos', async () => {
    const subs = topic.subtopics.map((s) => s.id)
    const bank = new Map([[topic.id, [question(subs[0], 1), question(subs[0], 2), question(subs[1], 3), question(subs[2], 4), question(subs[3], 5)]]])
    let calls = 0
    const generate = withPlacementBank(bank, async () => {
      calls++
      return []
    })
    const picked = await generate(topic)
    expect(calls).toBe(0)
    expect(picked).toHaveLength(PLACEMENT_QUESTIONS_PER_TOPIC)
    expect(new Set(picked.map((q) => q.subtopicId)).size).toBe(PLACEMENT_QUESTIONS_PER_TOPIC)
    for (const q of picked) expect(q.options[q.correctIndex]).toMatch(/^a/)
  })

  it('un tópico sin banco lo arma Claude', async () => {
    let calls = 0
    const generate = withPlacementBank(new Map(), async () => {
      calls++
      return []
    })
    await generate(curriculum[1])
    expect(calls).toBe(1)
  })
})
