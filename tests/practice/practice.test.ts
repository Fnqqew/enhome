import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Progression } from '../../src/main/engine/progression'
import type { OpenAnswerGrader } from '../../src/main/practice/ai-grading'
import { SESSION_SIZE } from '../../src/main/practice/composition'
import { tokenize } from '../../src/main/practice/exercises'
import type { PoolGenerator } from '../../src/main/practice/generation'
import { Practice } from '../../src/main/practice/practice'
import { addDays } from '../../src/shared/dates'
import type { ExerciseAnswer, ExerciseType, PracticeView, SessionView, StoredExercise } from '../../src/shared/exercises'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)

function sample(type: ExerciseType, n: number): StoredExercise {
  switch (type) {
    case 'multiple_choice':
      return { type, instruction: 'i', prompt: `Pregunta ${n}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' }
    case 'fill_blank':
      return { type, instruction: 'i', sentence: `She ___ happy ${n}.`, hint: '(be)', answers: ['is'], explanation: 'x' }
    case 'word_order':
      return { type, instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x', tokens: ['sister', 'is', 'She', 'my'] }
    case 'error_correction':
      return { type, instruction: 'i', sentence: `She are happy ${n}.`, answers: [`She is happy ${n}.`], explanation: 'x' }
    case 'translation':
      return { type, instruction: 'i', spanish: `Soy docente ${n}.`, answers: [`I am a teacher ${n}.`], explanation: 'x' }
    case 'reading': {
      const question = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
      return { type, instruction: 'i', text: `Texto ${n}`, questions: [question, question] }
    }
    case 'writing':
      return { type, instruction: 'i', task: `Consigna ${n}`, minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
  }
}

function rightAnswer(e: StoredExercise): ExerciseAnswer {
  switch (e.type) {
    case 'multiple_choice':
      return { type: e.type, choice: e.correctIndex }
    case 'fill_blank':
      return { type: e.type, text: e.answers[0] }
    case 'word_order':
      return { type: e.type, tokens: tokenize(e.sentence) }
    case 'error_correction':
    case 'translation':
      return { type: e.type, text: e.answers[0] }
    case 'reading':
      return { type: e.type, choices: e.questions.map((q) => q.correctIndex) }
    case 'writing':
      return { type: e.type, text: 'My name is Juan and I am from Rosario.' }
  }
}

let db: Db
let progression: Progression
let practice: Practice
let generated: string[]
let graded: string[]

const generator: PoolGenerator = async ({ subtopic, counts }) => {
  generated.push(subtopic.id)
  return (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) => Array.from({ length: count }, (_, i) => sample(type, i)))
}

const grader: OpenAnswerGrader = async ({ exercise, answer }) => {
  graded.push(exercise.type)
  const correct = answer.length > 10
  return { correct, score: correct ? 8 : 3, correctAnswer: 'ref', explanation: '', review: { correctedText: answer, comments: 'Bien.', mistakes: [] } }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  practice = new Practice(db, curriculum, progression, generator, grader)
  generated = []
  graded = []
  // Examen inicial el domingo: la semana de "El verbo to be" arranca el lunes 14/9.
  progression.applyPlacementResult('a1-to-be', [], day(-1))
})

const session = (view: PracticeView): SessionView => {
  if (view.status !== 'session') throw new Error(`se esperaba una sesión y llegó ${view.status}`)
  return view.session
}

const stored = (exerciseId: number): StoredExercise =>
  JSON.parse((db.prepare('SELECT payload FROM exercises WHERE id = ?').get(exerciseId) as { payload: string }).payload) as StoredExercise

async function answerAllRight(s: SessionView): Promise<SessionView> {
  let current = s
  for (const e of s.exercises) current = session(await practice.answer(e.id, rightAnswer(stored(e.id))))
  return current
}

describe('práctica del día', () => {
  it('muestra la introducción del subtema antes de empezar', () => {
    const view = practice.getView(MON)
    expect(view).toMatchObject({ status: 'ready', purpose: 'unit', unitIndex: 1, subtopicTitle: 'Pronombres personales' })
    if (view.status === 'ready') expect(view.keyPoints.length).toBeGreaterThan(0)
  })

  it('arma una sesión de 6 ejercicios con lectura y genera una sola vez', async () => {
    practice.getView(MON)
    const s = session(await practice.start(MON))
    expect(s.exercises).toHaveLength(SESSION_SIZE)
    expect(s.exercises.map((e) => e.type)).toContain('reading')
    expect(s.spareCount).toBeGreaterThan(0)
    expect(generated.filter((id) => id === 'pronombres-personales')).toHaveLength(1)
    expect(JSON.stringify(s)).not.toContain('correctIndex')
  })

  it('al terminar marca la práctica del día como hecha', async () => {
    const s = await answerAllRight(session(await practice.start(MON)))
    expect(s.canFinish).toBe(true)
    const result = practice.finish(s.id, MON)
    expect(result).toMatchObject({ purpose: 'unit', unitIndex: 1, correct: SESSION_SIZE, total: SESSION_SIZE })

    const week = progression.getState(MON).week!
    expect(week.completedUnits).toBe(1)
    expect(practice.getView(MON)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/martes/) })
  })

  it('no deja terminar con ejercicios sin responder', async () => {
    const s = session(await practice.start(MON))
    expect(() => practice.finish(s.id, MON)).toThrow(/sin responder/)
  })

  it('retoma la sesión empezada', async () => {
    const s = session(await practice.start(MON))
    await practice.answer(s.exercises[0].id, rightAnswer(stored(s.exercises[0].id)))
    const again = practice.getView(MON)
    expect(session(again).exercises[0].feedback?.correct).toBe(true)
  })

  it('no acepta responder dos veces ni con otro tipo de respuesta', async () => {
    const s = session(await practice.start(MON))
    const first = s.exercises[0]
    await expect(practice.answer(first.id, { type: 'writing', text: 'hola' })).rejects.toThrow(/no corresponde/)
    await practice.answer(first.id, rightAnswer(stored(first.id)))
    await expect(practice.answer(first.id, rightAnswer(stored(first.id)))).rejects.toThrow(/ya está respondido/)
  })

  it('cambiar de ejercicio usa una alternativa hasta que se acaban', async () => {
    let s = session(await practice.start(MON))
    const spares = s.spareCount
    const originalId = s.exercises[0].id
    s = session(practice.skip(originalId))
    expect(s.spareCount).toBe(spares - 1)
    expect(s.exercises).toHaveLength(SESSION_SIZE)
    expect(s.exercises.map((e) => e.id)).not.toContain(originalId)

    while (s.spareCount > 0) s = session(practice.skip(s.exercises[0].id))
    expect(() => practice.skip(s.exercises[0].id)).toThrow(/alternativos/)
  })

  it('una traducción distinta de la referencia la corrige Claude', async () => {
    const s = session(await practice.start(MON))
    const translation = s.exercises.find((e) => e.type === 'translation')!
    const view = session(await practice.answer(translation.id, { type: 'translation', text: 'I work teaching English' }))
    expect(graded).toEqual(['translation'])
    expect(view.exercises.find((e) => e.id === translation.id)?.feedback?.review?.comments).toBe('Bien.')
  })

  it('guarda la calificación del alumno solo después de responder', async () => {
    const s = session(await practice.start(MON))
    const first = s.exercises[0]
    expect(() => practice.rate(first.id, 5)).toThrow(/Primero/)
    await practice.answer(first.id, rightAnswer(stored(first.id)))
    expect(session(practice.rate(first.id, 5)).exercises[0].rating).toBe(5)
  })
})

describe('escritura y recuperación', () => {
  // Completa los días 1 a 4 sin faltar y deja el viernes para el subtema de escritura.
  function completeUntilThursday(): void {
    for (let i = 0; i < 4; i++) progression.completeUnit(progression.getState(day(i)).week!.nextUnit!.id, day(i))
  }

  it('el día de escritura incluye un texto que corrige Claude', async () => {
    completeUntilThursday()
    const s = session(await practice.start(day(4)))
    expect(s.exercises[s.exercises.length - 1].type).toBe('writing')
    await answerAllRight(s)
    expect(graded).toContain('writing')
  })

  it('el domingo con una falta se recupera con una sesión de repaso', async () => {
    // Faltó el lunes y se puso al día el martes.
    progression.completeUnit(progression.getState(day(1)).week!.nextUnit!.id, day(1))
    progression.completeUnit(progression.getState(day(1)).week!.nextUnit!.id, day(1))
    for (let i = 2; i <= 4; i++) progression.completeUnit(progression.getState(day(i)).week!.nextUnit!.id, day(i))

    expect(practice.getView(day(6))).toMatchObject({ status: 'ready', purpose: 'recovery', kind: 'review', subtopicTitle: 'Pronombres personales' })
    const s = await answerAllRight(session(await practice.start(day(6))))
    expect(practice.finish(s.id, day(6)).purpose).toBe('recovery')
    expect(progression.getState(day(6)).week?.recovered).toBe(true)
  })
})
