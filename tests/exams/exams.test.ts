import { longRightAnswer, longSample } from '../helpers/long-exercises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Progression } from '../../src/main/engine/progression'
import { Exams } from '../../src/main/exams/exams'
import type { ExamGenerator } from '../../src/main/exams/generation'
import type { OpenAnswerGrader } from '../../src/main/practice/ai-grading'
import { tokenize } from '../../src/main/practice/exercises'
import { addDays } from '../../src/shared/dates'
import { EXAM_INTERRUPTED_MESSAGE, type ExamQuestion, type ExamSessionView } from '../../src/shared/exams'
import type { ExerciseAnswer, ExerciseType, StoredExercise } from '../../src/shared/exercises'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)
const FRI = day(4)
const MINUTE = 60_000

function sample(type: ExerciseType, n: number): StoredExercise {
  switch (type) {
    case 'multiple_choice':
      return { type, instruction: 'i', prompt: `Pregunta ${n}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' }
    case 'fill_blank':
      return { type, instruction: 'i', sentence: `She ___ happy ${n}.`, hint: '', answers: ['is'], explanation: 'x' }
    case 'word_order':
      return { type, instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x', tokens: ['sister', 'is', 'She', 'my'] }
    case 'error_correction':
      return { type, instruction: 'i', sentence: `She are happy ${n}.`, answers: [`She is happy ${n}.`], explanation: 'x' }
    case 'translation':
      return { type, instruction: 'i', spanish: 'Soy docente.', answers: ['I am a teacher.'], explanation: 'x' }
    case 'reading': {
      const q = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
      return { type, instruction: 'i', text: 't', questions: [q, q] }
    }
    case 'writing':
      return { type, instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
    case 'translation_set':
    case 'dialogue':
    case 'roleplay':
      return longSample(type, n)
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
    case 'translation_set':
    case 'dialogue':
    case 'roleplay':
      return longRightAnswer(e)
  }
}

let db: Db
let progression: Progression
let exams: Exams
let clock: number
let generations: number
let gradedOpen: string[]

const generator: ExamGenerator = async (request) => {
  generations++
  return request.items.map((item, i) => ({ topicId: item.topic.id, subtopicId: item.subtopic.id, exercise: sample(item.type, i) }))
}

const grader: OpenAnswerGrader = async ({ exercise, answers }) => {
  gradedOpen.push(exercise.type)
  const text = answers.join(' ')
  const correct = text.length > 10
  return { correct, score: correct ? 8 : 2, correctAnswer: 'ref', explanation: '', review: { correctedText: text, comments: 'ok', mistakes: [] } }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  clock = Date.parse('2026-09-18T15:00:00Z')
  exams = new Exams(db, curriculum, progression, generator, grader, () => clock)
  generations = 0
  gradedOpen = []
  // Empieza en «Sustantivos y artículos» (prerrequisito: «El verbo to be») y practica toda la semana.
  progression.applyPlacementResult('a1-nouns-articles', [], day(-1))
  for (let i = 0; i < 5; i++) progression.completeUnit(progression.getState(day(i)).week!.nextUnit!.id, day(i))
})

const storedQuestions = (examId: number): ExamQuestion[] =>
  JSON.parse((db.prepare('SELECT questions FROM exams WHERE id = ?').get(examId) as { questions: string }).questions) as ExamQuestion[]

function answerAll(session: ExamSessionView, pick: (q: ExamQuestion) => boolean = () => true): void {
  storedQuestions(session.id).forEach((q, i) => {
    if (pick(q)) exams.saveAnswer(session.id, i, rightAnswer(q.exercise))
  })
}

describe('examen semanal', () => {
  it('se prepara en segundo plano y se rinde con 20 preguntas', async () => {
    const overview = await exams.getOverview(FRI)
    expect(overview.weekly).toMatchObject({ available: true, preparing: true })

    const session = await exams.startWeekly(FRI)
    expect(session.questions).toHaveLength(20)
    expect(generations).toBe(1)
    expect(exams.hasBlockingExam()).toBe(true)
    expect(db.prepare('SELECT COUNT(*) AS n FROM exam_drafts').get()).toEqual({ n: 0 })
    expect(JSON.stringify(session)).not.toContain('correctIndex')
  })

  it('con todo bien aprueba y el tópico siguiente arranca el lunes', async () => {
    const session = await exams.startWeekly(FRI)
    answerAll(session)
    const result = await exams.submit(session.id, FRI)

    expect(result.passed).toBe(true)
    expect(result.grade).toBe(9.9)
    expect(gradedOpen).toEqual(['writing'])
    expect(result.outcome).toMatchObject({ nextWeekStart: day(7), retry: false })
    expect(progression.getState(FRI).week?.topicId).toBe('a1-present-simple')
    expect(exams.hasBlockingExam()).toBe(false)
    expect((await exams.getOverview(FRI)).history[0]).toMatchObject({ kind: 'weekly', grade: 9.9, passed: true, status: 'submitted' })
  })

  it('lo que no se responde cuenta como incorrecto', async () => {
    const session = await exams.startWeekly(FRI)
    answerAll(session, (q) => q.topicId === 'a1-to-be')
    const result = await exams.submit(session.id, FRI)

    expect(result.grade).toBe(2)
    expect(result.passed).toBe(false)
    expect(result.outcome?.retry).toBe(true)
    expect(result.questions.filter((q) => q.answer === null)).toHaveLength(16)
    const review = result.breakdown.filter((b) => b.topicTitle === 'El verbo to be')
    expect(review.reduce((sum, b) => sum + b.correct, 0)).toBe(4)
    expect(review.reduce((sum, b) => sum + b.total, 0)).toBe(4)
    expect(progression.getState(day(7)).week?.kind).toBe('retry')
  })

  it('no permite dos pruebas a la vez ni respuestas de otro tipo', async () => {
    const session = await exams.startWeekly(FRI)
    await expect(exams.startWeekly(FRI)).rejects.toThrow(/en curso/)
    await expect(exams.startMock('topic', FRI)).rejects.toThrow(/en curso/)
    const first = storedQuestions(session.id)[0]
    const wrongType: ExerciseAnswer = first.exercise.type === 'writing' ? { type: 'translation', text: 'x' } : { type: 'writing', text: 'x' }
    expect(() => exams.saveAnswer(session.id, 0, wrongType)).toThrow(/no corresponde/)
  })
})

describe('interrupciones', () => {
  it('primera interrupción: pausa y se retoma; segunda: se entrega sola', async () => {
    const session = await exams.startWeekly(FRI)
    answerAll(session)

    clock += 2 * MINUTE
    expect(() => exams.heartbeat(session.id)).toThrow(EXAM_INTERRUPTED_MESSAGE)
    const paused = await exams.getOverview(FRI)
    expect(paused.exam).toMatchObject({ state: 'paused', minutesLeft: 28 })
    expect(exams.hasBlockingExam()).toBe(true)

    const resumed = await exams.resume(session.id, FRI)
    expect(resumed).toMatchObject({ state: 'active', session: { pauseUsed: true } })

    clock += 2 * MINUTE
    const after = await exams.getOverview(FRI)
    expect(after.exam).toBeNull()
    expect(after.notice).toMatch(/automáticamente/)
    expect(after.history[0]).toMatchObject({ status: 'submitted', endReason: 'second-interruption', passed: true })
  })

  it('si la pausa pasa los 30 minutos, se anula sin contar y se puede rendir otro', async () => {
    const session = await exams.startWeekly(FRI)
    clock += 31 * MINUTE
    const overview = await exams.getOverview(FRI)

    expect(overview.exam).toBeNull()
    expect(overview.notice).toMatch(/anuló/)
    expect(overview.history[0]).toMatchObject({ id: session.id, status: 'voided', endReason: 'pause-expired' })
    expect(overview.weekly.available).toBe(true)
    expect(progression.getState(FRI).attempts).toEqual({ attempts: 0, failed: 0 })

    const again = await exams.startWeekly(FRI)
    expect(again.id).not.toBe(session.id)
    expect(generations).toBe(2)
  })
})

describe('medianoche', () => {
  it('un examen empezado el domingo y entregado el lunes se evalúa en su semana', async () => {
    const session = await exams.startWeekly(day(6))
    // Pasa la medianoche con el examen abierto: la semana no se cierra.
    expect(progression.getState(day(7)).week).toMatchObject({ topicId: 'a1-nouns-articles', kind: 'normal' })

    answerAll(session)
    const result = await exams.submit(session.id, day(7))
    expect(result.passed).toBe(true)
    expect(result.outcome?.nextWeekStart).toBe(day(7))
    expect(progression.getState(day(7)).week?.topicId).toBe('a1-present-simple')
  })
})

describe('simulacros', () => {
  it('no bloquea, no cuenta para aprobar y marca tópicos anteriores débiles', async () => {
    const session = await exams.startMock('general', FRI)
    expect(session.questions).toHaveLength(10)
    expect(exams.hasBlockingExam()).toBe(false)

    answerAll(session, (q) => q.topicId === 'a1-nouns-articles')
    const result = await exams.submit(session.id, FRI)

    expect(result).toMatchObject({ kind: 'mock', grade: 5, passed: null })
    expect(result.outcome?.weakTopics).toEqual(['El verbo to be'])
    expect(progression.getState(FRI).reviewTopics.map((t) => t.id)).toEqual(['a1-to-be'])
    expect(progression.getState(FRI).attempts).toEqual({ attempts: 0, failed: 0 })
  })

  it('se puede descartar', async () => {
    const session = await exams.startMock('topic', FRI)
    expect(session.title).toBe('Simulacro · Sustantivos, artículos y there is / there are')
    exams.discardMock(session.id)
    const overview = await exams.getOverview(FRI)
    expect(overview.exam).toBeNull()
    expect(overview.history[0]).toMatchObject({ status: 'voided' })
  })
})
