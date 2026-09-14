// Cálculo puro de qué se practica cada semana y de qué tópicos anteriores necesitan repaso.

import type { Topic } from '../../shared/curriculum'
import type { UnitKind } from '../../shared/progress'
import {
  MIN_QUESTIONS_FOR_WEAKNESS,
  PRACTICE_DAYS,
  REVIEW_AFTER_FAILURES,
  REVIEW_UNITS,
  WEAK_TOPIC_ERROR_RATE
} from './rules'

export interface PlannedUnit {
  kind: UnitKind
  topicId: string
  subtopicId: string
}

// Una respuesta de examen etiquetada con lo que evalúa.
export interface AnswerTag {
  topicId: string
  subtopicId: string | null
  correct: boolean
}

const byDay = (topic: Topic): Topic['subtopics'] => [...topic.subtopics].sort((a, b) => a.day - b.day)

export function planLessonWeek(topic: Topic): PlannedUnit[] {
  return byDay(topic).map((s) => ({ kind: 'lesson', topicId: topic.id, subtopicId: s.id }))
}

// Semana de continuación: primero lo que quedó pendiente, el resto con repaso del mismo tópico.
export function planCarryWeek(topic: Topic, pending: PlannedUnit[]): PlannedUnit[] {
  const units = pending.slice(0, PRACTICE_DAYS)
  const subtopics = byDay(topic)
  for (let i = 0; units.length < PRACTICE_DAYS; i++) {
    units.push({ kind: 'review', topicId: topic.id, subtopicId: subtopics[i % subtopics.length].id })
  }
  return units
}

function errorRate(answers: AnswerTag[], topicId: string): number {
  const tagged = answers.filter((a) => a.topicId === topicId)
  return tagged.length === 0 ? 0 : tagged.filter((a) => !a.correct).length / tagged.length
}

// Subtemas con errores, de más a menos errores; si no hubo errores etiquetados, todos en orden.
function rankSubtopics(topic: Topic, answers: AnswerTag[]): Topic['subtopics'] {
  const errors = new Map<string, number>()
  for (const a of answers) {
    if (!a.correct && a.topicId === topic.id && a.subtopicId) errors.set(a.subtopicId, (errors.get(a.subtopicId) ?? 0) + 1)
  }
  const ranked = byDay(topic)
    .filter((s) => (errors.get(s.id) ?? 0) > 0)
    .sort((a, b) => errors.get(b.id)! - errors.get(a.id)!)
  return ranked.length > 0 ? ranked : byDay(topic)
}

// Semana de reintento: refuerzo de lo que falló y, desde el segundo reprobado, repaso de prerrequisitos.
export function planRetryWeek(
  topic: Topic,
  answers: AnswerTag[],
  failedAttempts: number,
  prerequisites: Topic[]
): PlannedUnit[] {
  const units: PlannedUnit[] = []

  if (failedAttempts >= REVIEW_AFTER_FAILURES && prerequisites.length > 0) {
    const ranked = [...prerequisites].sort((a, b) => errorRate(answers, b.id) - errorRate(answers, a.id))
    for (let i = 0; i < REVIEW_UNITS; i++) {
      const prerequisite = ranked[i % ranked.length]
      const used = units.filter((u) => u.topicId === prerequisite.id).length
      const subtopics = rankSubtopics(prerequisite, answers)
      units.push({ kind: 'review', topicId: prerequisite.id, subtopicId: subtopics[used % subtopics.length].id })
    }
  }

  const focus = rankSubtopics(topic, answers)
  for (let i = 0; units.length < PRACTICE_DAYS; i++) {
    units.push({ kind: 'focus', topicId: topic.id, subtopicId: focus[i % focus.length].id })
  }
  return units
}

// Tópicos distintos del actual con demasiados errores.
export function detectWeakTopics(answers: AnswerTag[], currentTopicId: string | null): string[] {
  const stats = new Map<string, { total: number; wrong: number }>()
  for (const a of answers) {
    if (a.topicId === currentTopicId) continue
    const s = stats.get(a.topicId) ?? { total: 0, wrong: 0 }
    s.total++
    if (!a.correct) s.wrong++
    stats.set(a.topicId, s)
  }
  return [...stats]
    .filter(([, s]) => s.total >= MIN_QUESTIONS_FOR_WEAKNESS && s.wrong / s.total > WEAK_TOPIC_ERROR_RATE)
    .map(([id]) => id)
}
