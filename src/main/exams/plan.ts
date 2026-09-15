// Qué preguntas lleva cada prueba (cálculo puro).

import type { Subtopic, Topic } from '../../shared/curriculum'
import type { ExerciseType } from '../../shared/exercises'
import { MOCK_EXAM_SIZE, WEEKLY_EXAM_SIZE } from './rules'

export interface ExamItemPlan {
  topicId: string
  subtopicId: string
  type: ExerciseType
}

const CLOSED: ExerciseType[] = ['multiple_choice', 'fill_blank', 'error_correction', 'word_order']
const byDay = (topic: Topic): Subtopic[] => [...topic.subtopics].sort((a, b) => a.day - b.day)

// 2 cerradas por subtema + 3 extra en los subtemas con más errores, repaso de tópicos anteriores,
// y al final traducción, lectura y escritura (si el tópico las trabaja).
export function planWeeklyExam(topic: Topic, reviewTopics: Topic[], weakness: Map<string, number> = new Map()): ExamItemPlan[] {
  const subtopics = byDay(topic)
  const item = (t: Topic, s: Subtopic, type: ExerciseType): ExamItemPlan => ({ topicId: t.id, subtopicId: s.id, type })
  let turn = 0
  const nextClosed = (): ExerciseType => CLOSED[turn++ % CLOSED.length]

  const ranked = [...subtopics].sort((a, b) => (weakness.get(b.id) ?? 0) - (weakness.get(a.id) ?? 0) || a.day - b.day)
  const extraFor = (i: number): Subtopic => ranked[i % ranked.length]

  const closed: ExamItemPlan[] = []
  for (const s of subtopics) for (let k = 0; k < 2; k++) closed.push(item(topic, s, nextClosed()))
  let extras = 0
  for (; extras < 3; extras++) closed.push(item(topic, extraFor(extras), nextClosed()))

  const open: ExamItemPlan[] = []
  const readingSubtopic = subtopics.find((s) => s.focus.includes('reading'))
  const writingSubtopic = subtopics.find((s) => s.focus.includes('writing'))
  open.push(item(topic, writingSubtopic ?? subtopics[subtopics.length - 1], 'translation'))
  if (readingSubtopic) open.push(item(topic, readingSubtopic, 'reading'))
  else closed.push(item(topic, extraFor(extras++), nextClosed()))
  if (writingSubtopic) open.push(item(topic, writingSubtopic, 'writing'))
  else closed.push(item(topic, extraFor(extras++), nextClosed()))

  const review: ExamItemPlan[] = []
  const reviewSubtopics = reviewTopics.flatMap((t) => byDay(t).map((s) => [t, s] as const))
  const remaining = WEEKLY_EXAM_SIZE - closed.length - open.length
  for (let i = 0; i < remaining; i++) {
    if (reviewSubtopics.length > 0) {
      const [t, s] = reviewSubtopics[i % reviewSubtopics.length]
      review.push(item(t, s, i % 2 === 0 ? 'multiple_choice' : 'fill_blank'))
    } else {
      closed.push(item(topic, extraFor(extras++), nextClosed()))
    }
  }

  const day = new Map(subtopics.map((s) => [s.id, s.day]))
  closed.sort((a, b) => day.get(a.subtopicId)! - day.get(b.subtopicId)!)
  return [...closed, ...review, ...open]
}

// Simulacro: preguntas cerradas repartidas entre los tópicos y sus subtemas.
export function planMockExam(topics: Topic[]): ExamItemPlan[] {
  const pairs: [Topic, Subtopic][] = []
  const longest = Math.max(...topics.map((t) => t.subtopics.length))
  for (let d = 0; d < longest; d++) {
    for (const topic of topics) {
      const subtopic = byDay(topic)[d]
      if (subtopic) pairs.push([topic, subtopic])
    }
  }
  return Array.from({ length: MOCK_EXAM_SIZE }, (_, i) => {
    const [topic, subtopic] = pairs[i % pairs.length]
    return { topicId: topic.id, subtopicId: subtopic.id, type: CLOSED[i % CLOSED.length] }
  })
}
