import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Placement, type QuestionGenerator } from '../../src/main/engine/placement'
import { shuffleOptions } from '../../src/main/engine/placement-questions'
import { Progression } from '../../src/main/engine/progression'
import type { PlacementView } from '../../src/shared/progress'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const TODAY = '2026-09-13' // domingo

// La opción correcta siempre es la 0.
const generator: QuestionGenerator = async (topic) =>
  topic.subtopics.slice(0, 3).map((s) => ({
    subtopicId: s.id,
    instruction: 'Elegí la opción correcta.',
    prompt: `Pregunta de ${s.id}`,
    options: ['bien', 'mal 1', 'mal 2', 'mal 3'],
    correctIndex: 0,
    explanation: 'Porque sí.'
  }))

let db: Db
let progression: Progression
let placement: Placement
let generatedTopics: string[]

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  generatedTopics = []
  placement = new Placement(db, curriculum, progression, async (topic) => {
    generatedTopics.push(topic.id)
    return generator(topic)
  })
})

// Responde según decide(topicNumber, questionNumber) hasta que el examen termina.
async function answerAll(decide: (topicNumber: number) => number): Promise<PlacementView> {
  placement.start()
  let view = await placement.view(TODAY)
  while (view.status === 'question') view = await placement.answer(view.question.id, decide(view.topicNumber), TODAY)
  return view
}

describe('examen inicial', () => {
  it('empieza en el primer tópico con menos de 2 aciertos de 3', async () => {
    const view = await answerAll((topicNumber) => (topicNumber < 3 ? 0 : -1))
    expect(view).toMatchObject({ status: 'finished', startTopicTitle: curriculum[2].title, correct: 6, answered: 9 })

    const state = progression.getState(TODAY)
    expect(state.placementDone).toBe(true)
    expect(state.week?.topicId).toBe(curriculum[2].id)
  })

  it('si responde todo bien, supera el temario completo', async () => {
    const view = await answerAll(() => 0)
    expect(view).toMatchObject({ status: 'finished', startTopicTitle: null, answered: curriculum.length * 3 })
    expect(progression.getState(TODAY).finished).toBe(true)
  })

  it('con 2 de 3 pasa el tópico', async () => {
    placement.start()
    let view = await placement.view(TODAY)
    const choices = [0, 1, 0]
    for (const choice of choices) {
      if (view.status !== 'question') throw new Error('se esperaba una pregunta')
      view = await placement.answer(view.question.id, choice, TODAY)
    }
    expect(view).toMatchObject({ status: 'question', topicNumber: 2 })
  })

  it('se puede retomar después de cerrar la app', async () => {
    placement.start()
    const first = await placement.view(TODAY)
    if (first.status !== 'question') throw new Error('se esperaba una pregunta')
    await placement.answer(first.question.id, 0, TODAY)

    const reopened = new Placement(db, curriculum, progression, generator)
    expect(await reopened.view(TODAY)).toMatchObject({ status: 'question', answeredInTopic: 1 })
  })

  it('rechaza respuestas a una pregunta que no es la actual', async () => {
    placement.start()
    await placement.view(TODAY)
    await expect(placement.answer(`${curriculum[0].id}-3`, 0, TODAY)).rejects.toThrow(/actual/)
  })

  it('no genera dos veces el mismo tópico', async () => {
    await answerAll((topicNumber) => (topicNumber < 2 ? 0 : -1))
    expect(new Set(generatedTopics).size).toBe(generatedTopics.length)
  })

  it('no deja empezar de nuevo una vez terminado', async () => {
    await answerAll(() => -1)
    expect(() => placement.start()).toThrow(/ya está hecho/)
  })
})

describe('shuffleOptions', () => {
  it('mantiene apuntada la opción correcta', () => {
    const q = { subtopicId: 's', instruction: 'i', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'e' }
    const values = [0.9, 0.1, 0.5]
    const shuffled = shuffleOptions(q, () => values.shift() ?? 0)
    expect(shuffled.options).toHaveLength(4)
    expect(shuffled.options[shuffled.correctIndex]).toBe('c')
  })
})
