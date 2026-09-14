import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { detectWeakTopics, planCarryWeek, planLessonWeek, planRetryWeek, type AnswerTag } from '../../src/main/engine/planning'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = (id: string) => curriculum.find((t) => t.id === id)!
const toBe = topic('a1-to-be')
const nouns = topic('a1-nouns-articles')

const wrong = (topicId: string, subtopicId: string): AnswerTag => ({ topicId, subtopicId, correct: false })
const right = (topicId: string, subtopicId: string): AnswerTag => ({ topicId, subtopicId, correct: true })

describe('planLessonWeek', () => {
  it('un subtema por día en orden', () => {
    expect(planLessonWeek(toBe).map((u) => u.subtopicId)).toEqual(toBe.subtopics.map((s) => s.id))
  })
})

describe('planCarryWeek', () => {
  it('pone primero lo pendiente y completa con repaso', () => {
    const pending = planLessonWeek(toBe).slice(3)
    const units = planCarryWeek(toBe, pending)
    expect(units).toHaveLength(5)
    expect(units.slice(0, 2)).toEqual(pending)
    expect(units.slice(2).every((u) => u.kind === 'review' && u.topicId === toBe.id)).toBe(true)
  })
})

describe('planRetryWeek', () => {
  const [s1, s2, s3] = nouns.subtopics.map((s) => s.id)

  it('primer reprobado: refuerza los subtemas con más errores', () => {
    const answers = [wrong(nouns.id, s3), wrong(nouns.id, s3), wrong(nouns.id, s1), right(nouns.id, s2)]
    const units = planRetryWeek(nouns, answers, 1, [toBe])
    expect(units.map((u) => u.subtopicId)).toEqual([s3, s1, s3, s1, s3])
    expect(units.every((u) => u.kind === 'focus')).toBe(true)
  })

  it('segundo reprobado: arranca con 2 repasos de prerrequisitos', () => {
    const answers = [wrong(nouns.id, s2), wrong(toBe.id, toBe.subtopics[3].id)]
    const units = planRetryWeek(nouns, answers, 2, [toBe])
    expect(units.slice(0, 2).map((u) => [u.kind, u.topicId])).toEqual([
      ['review', toBe.id],
      ['review', toBe.id]
    ])
    expect(units[0].subtopicId).toBe(toBe.subtopics[3].id)
    expect(units.slice(2).every((u) => u.kind === 'focus' && u.subtopicId === s2)).toBe(true)
  })

  it('sin prerrequisitos, todo es refuerzo', () => {
    expect(planRetryWeek(toBe, [], 3, []).every((u) => u.kind === 'focus')).toBe(true)
  })
})

describe('detectWeakTopics', () => {
  it('marca tópicos anteriores con más del 40 % de errores', () => {
    const answers = [
      wrong(toBe.id, 'x'),
      right(toBe.id, 'x'),
      wrong(toBe.id, 'x'),
      wrong(nouns.id, 'x'),
      wrong(nouns.id, 'x')
    ]
    expect(detectWeakTopics(answers, nouns.id)).toEqual([toBe.id])
  })

  it('no marca con 40 % justo ni con una sola pregunta', () => {
    const fortyPercent = [wrong(toBe.id, 'x'), wrong(toBe.id, 'x'), right(toBe.id, 'x'), right(toBe.id, 'x'), right(toBe.id, 'x')]
    expect(detectWeakTopics(fortyPercent, nouns.id)).toEqual([])
    expect(detectWeakTopics([wrong(toBe.id, 'x')], nouns.id)).toEqual([])
  })
})
