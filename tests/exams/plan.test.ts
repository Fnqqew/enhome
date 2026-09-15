import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { planMockExam, planWeeklyExam } from '../../src/main/exams/plan'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = (id: string) => curriculum.find((t) => t.id === id)!
const OPEN = ['translation', 'reading', 'writing']

describe('planWeeklyExam', () => {
  const nouns = topic('a1-nouns-articles')

  it('20 preguntas: todos los subtemas, 4 de repaso y lo abierto al final', () => {
    const plan = planWeeklyExam(nouns, [topic('a1-to-be')])
    expect(plan).toHaveLength(20)
    expect(plan.filter((p) => p.topicId === 'a1-to-be')).toHaveLength(4)
    expect(plan.slice(-3).map((p) => p.type)).toEqual(OPEN)
    for (const s of nouns.subtopics) expect(plan.some((p) => p.topicId === nouns.id && p.subtopicId === s.id)).toBe(true)
  })

  it('sin tópicos para repasar, todas las preguntas son del tópico', () => {
    const plan = planWeeklyExam(topic('a1-to-be'), [])
    expect(plan).toHaveLength(20)
    expect(plan.every((p) => p.topicId === 'a1-to-be')).toBe(true)
  })

  it('los subtemas con más errores en la práctica reciben preguntas extra', () => {
    const [d1, , , d4, d5] = [...nouns.subtopics].sort((a, b) => a.day - b.day)
    const plan = planWeeklyExam(nouns, [], new Map([[d5.id, 0.9]]))
    const closed = (subtopicId: string): number => plan.filter((p) => p.subtopicId === subtopicId && !OPEN.includes(p.type)).length
    expect(closed(d5.id)).toBeGreaterThan(closed(d4.id))
    expect(closed(d1.id)).toBeGreaterThanOrEqual(2)
  })
})

describe('planMockExam', () => {
  it('10 preguntas cerradas repartidas entre los tópicos', () => {
    const plan = planMockExam([topic('a1-to-be'), topic('a1-nouns-articles')])
    expect(plan).toHaveLength(10)
    expect(plan.filter((p) => p.topicId === 'a1-to-be')).toHaveLength(5)
    expect(plan.some((p) => OPEN.includes(p.type))).toBe(false)
  })
})
