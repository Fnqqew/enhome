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
    {
      source: 'practice',
      sourceId: 1,
      topicId: topic.id,
      subtopicId: topic.subtopics[0].id,
      exercise: mcq,
      given: { type: 'multiple_choice', choice: 1 }
    },
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

  it('al acertarlo vuelve cada vez más espaciado hasta quedar aprendido', async () => {
    let day = addDays(TODAY, 1)
    const id = notebook.due(day)[0].id
    const gaps: number[] = []
    let learned = false
    for (let review = 0; review < 6 && !learned; review++) {
      const result = await notebook.answer(id, { type: 'multiple_choice', choice: 0 }, day)
      const gap = Math.round((Date.parse(result.nextDue!) - Date.parse(day)) / 86_400_000)
      gaps.push(gap)
      learned = result.learned
      day = result.nextDue!
    }
    // FSRS: cada acierto aleja el próximo repaso, y en pocos repasos queda aprendido (a semanas de distancia).
    expect(gaps.every((gap, i) => i === 0 || gap > gaps[i - 1])).toBe(true)
    expect(learned).toBe(true)
    expect(gaps[gaps.length - 1]).toBeGreaterThanOrEqual(21)
    expect(notebook.overview(day)).toMatchObject({ pending: 0, learned: 1 })
  })

  it('si se vuelve a fallar, vuelve al día siguiente', async () => {
    const day = addDays(TODAY, 1)
    const id = notebook.due(day)[0].id
    const first = await notebook.answer(id, { type: 'multiple_choice', choice: 0 }, day)
    const wrong = await notebook.answer(id, { type: 'multiple_choice', choice: 2 }, first.nextDue!)
    expect(wrong).toMatchObject({ stage: 0, learned: false, nextDue: addDays(first.nextDue!, 1) })
  })

  it('el repaso de un examen trae todas sus preguntas falladas aunque no venzan hoy', () => {
    for (const index of [0, 3]) {
      recordMistake(
        db,
        { source: 'exam', sourceId: 7, index, topicId: topic.id, subtopicId: topic.subtopics[1].id, exercise: mcq, given: null },
        TODAY
      )
    }
    expect(notebook.fromExam(7)).toHaveLength(2)
    expect(notebook.due(TODAY)).toHaveLength(0)
  })

  it('los textos largos no se anotan', () => {
    const writing: StoredExercise = { type: 'writing', instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
    recordMistake(
      db,
      { source: 'practice', sourceId: 2, topicId: topic.id, subtopicId: topic.subtopics[0].id, exercise: writing, given: null },
      TODAY
    )
    expect(notebook.overview(TODAY).pending).toBe(1)
  })
})
