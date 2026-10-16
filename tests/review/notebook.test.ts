import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import type { OpenAnswerGrader } from '../../src/main/practice/ai-grading'
import { Notebook, recordMistake } from '../../src/main/review/notebook'
import { addDays } from '../../src/shared/dates'
import type { StoredExercise } from '../../src/shared/exercises'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = curriculum[0]
const TODAY = '2026-10-16'

const mcq: StoredExercise = {
  type: 'multiple_choice',
  instruction: 'Elegí.',
  prompt: 'She ___ my sister.',
  options: ['is', 'are', 'am', 'be'],
  correctIndex: 0,
  explanation: 'Con she va is.'
}

const grader: OpenAnswerGrader = async () => ({ correct: true, score: 9, correctAnswer: null, explanation: 'Bien.' })

let db: Db
let notebook: Notebook

beforeEach(() => {
  db = openDatabase(':memory:')
  notebook = new Notebook(db, curriculum, grader)
  recordMistake(
    db,
    { source: 'practice', sourceId: 1, topicId: topic.id, subtopicId: topic.subtopics[0].id, exercise: mcq, given: { type: 'multiple_choice', choice: 1 } },
    TODAY
  )
})

describe('cuaderno de errores', () => {
  it('un error anotado vuelve al día siguiente, no el mismo día', () => {
    expect(notebook.overview(TODAY)).toMatchObject({ dueToday: 0, pending: 1 })
    const tomorrow = addDays(TODAY, 1)
    expect(notebook.due(tomorrow)).toHaveLength(1)
    expect(notebook.due(tomorrow)[0]).toMatchObject({ topicTitle: topic.title, given: { choice: 1 }, stage: 0 })
  })

  it('el mismo ejercicio no se anota dos veces', () => {
    recordMistake(db, { source: 'practice', sourceId: 1, topicId: topic.id, subtopicId: topic.subtopics[0].id, exercise: mcq, given: null }, TODAY)
    expect(notebook.overview(TODAY).pending).toBe(1)
  })

  it('acertado cuatro veces seguidas (1, 3, 7 y 15 días) queda aprendido', async () => {
    let day = addDays(TODAY, 1)
    const id = notebook.due(day)[0].id
    const steps = [3, 7, 15]
    for (const wait of steps) {
      const result = await notebook.answer(id, { type: 'multiple_choice', choice: 0 }, day)
      expect(result.learned).toBe(false)
      expect(result.nextDue).toBe(addDays(day, wait))
      day = result.nextDue!
    }
    const last = await notebook.answer(id, { type: 'multiple_choice', choice: 0 }, day)
    expect(last).toMatchObject({ learned: true, nextDue: null })
    expect(notebook.overview(day)).toMatchObject({ pending: 0, learned: 1 })
  })

  it('si se vuelve a fallar, empieza de nuevo', async () => {
    const day = addDays(TODAY, 1)
    const id = notebook.due(day)[0].id
    await notebook.answer(id, { type: 'multiple_choice', choice: 0 }, day)
    const wrong = await notebook.answer(id, { type: 'multiple_choice', choice: 2 }, addDays(day, 3))
    expect(wrong).toMatchObject({ stage: 0, learned: false, nextDue: addDays(day, 4) })
  })

  it('el repaso de un examen trae todas sus preguntas falladas aunque no venzan hoy', () => {
    for (const index of [0, 3]) {
      recordMistake(db, { source: 'exam', sourceId: 7, index, topicId: topic.id, subtopicId: topic.subtopics[1].id, exercise: mcq, given: null }, TODAY)
    }
    expect(notebook.fromExam(7)).toHaveLength(2)
    expect(notebook.due(TODAY)).toHaveLength(0)
  })

  it('los textos largos no se anotan', () => {
    const writing: StoredExercise = { type: 'writing', instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
    recordMistake(db, { source: 'practice', sourceId: 2, topicId: topic.id, subtopicId: topic.subtopics[0].id, exercise: writing, given: null }, TODAY)
    expect(notebook.overview(TODAY).pending).toBe(1)
  })
})
