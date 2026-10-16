// Banco fijo de preguntas del examen inicial (content/<idioma>/placement.json): preguntas escritas y
// revisadas para los primeros tópicos, así el examen arranca al instante. Los tópicos sin banco
// los sigue armando Claude.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import type { LanguageId } from '../../shared/languages'
import type { GeneratedQuestion, QuestionGenerator } from '../engine/placement'
import { shuffleOptions } from '../engine/placement-questions'
import { PLACEMENT_QUESTIONS_PER_TOPIC } from '../engine/rules'
import { shuffled } from '../shuffle'
import { CurriculumError } from './curriculum'

const text = z.string().trim().min(1)

const questionSchema = z
  .object({
    subtopicId: text,
    instruction: text,
    prompt: text,
    options: z.array(text).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: text
  })
  .strict()

const bankSchema = z.object({ topics: z.record(z.string(), z.array(questionSchema)) }).strict()

export type PlacementBank = Map<string, GeneratedQuestion[]>

export function loadPlacementBank(dir: string, language: LanguageId, curriculum: CurriculumTopic[]): PlacementBank {
  const path = join(dir, language, 'placement.json')
  const bank: PlacementBank = new Map()
  if (!existsSync(path)) return bank

  let parsed: z.infer<typeof bankSchema>
  try {
    parsed = bankSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (err) {
    throw new CurriculumError(`${language}/placement.json es inválido: ${err instanceof Error ? err.message : String(err)}`)
  }

  const topics = new Map(curriculum.map((t) => [t.id, t]))
  for (const [topicId, questions] of Object.entries(parsed.topics)) {
    const topic = topics.get(topicId)
    if (!topic) throw new CurriculumError(`${language}/placement.json: el tópico ${topicId} no existe.`)
    questions.forEach((q, i) => {
      const where = `${language}/placement.json, ${topicId} #${i + 1}`
      if (!topic.subtopics.some((s) => s.id === q.subtopicId)) throw new CurriculumError(`${where}: el subtema ${q.subtopicId} no existe.`)
      if (new Set(q.options.map((o) => o.toLowerCase())).size !== 4) throw new CurriculumError(`${where}: tiene opciones repetidas.`)
    })
    if (new Set(questions.map((q) => q.subtopicId)).size < PLACEMENT_QUESTIONS_PER_TOPIC) {
      throw new CurriculumError(`${language}/placement.json: ${topicId} necesita preguntas de al menos ${PLACEMENT_QUESTIONS_PER_TOPIC} subtemas distintos.`)
    }
    bank.set(topicId, questions)
  }
  return bank
}

// Elige preguntas de subtemas distintos y mezcla las opciones; sin banco para el tópico, va a Claude.
export function withPlacementBank(bank: PlacementBank, generate: QuestionGenerator, random: () => number = Math.random): QuestionGenerator {
  return async (topic) => {
    const questions = bank.get(topic.id)
    if (!questions) return generate(topic)
    const picked: GeneratedQuestion[] = []
    for (const q of shuffled(questions, random)) {
      if (picked.length === PLACEMENT_QUESTIONS_PER_TOPIC) break
      if (!picked.some((p) => p.subtopicId === q.subtopicId)) picked.push(q)
    }
    return picked.map((q) => shuffleOptions(q, random))
  }
}
