// Formato del temario base (content/<nivel>/<nn-tópico>/topic.json + resumen.md).

import { z } from 'zod'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export const SKILLS = ['grammar', 'reading', 'writing'] as const

export type CefrLevel = (typeof CEFR_LEVELS)[number]
export type Skill = (typeof SKILLS)[number]

const slug = z.string().regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones')
const text = z.string().trim().min(1)

export const subtopicSchema = z
  .object({
    id: slug,
    day: z.number().int().min(1).max(5),
    title: text,
    goal: text,
    focus: z.array(z.enum(SKILLS)).min(1),
    keyPoints: z.array(text).min(1),
    examples: z.array(z.object({ en: text, es: text }).strict()).min(2),
    commonMistakes: z.array(z.object({ wrong: text, right: text, why: text }).strict())
  })
  .strict()

export const topicSchema = z
  .object({
    id: slug,
    level: z.enum(CEFR_LEVELS),
    order: z.number().int().min(1),
    title: text,
    titleEn: text,
    description: text,
    objectives: z.array(text).min(1),
    prerequisites: z.array(slug),
    reviewed: z.boolean(),
    subtopics: z.array(subtopicSchema).length(5)
  })
  .strict()

export type Subtopic = z.infer<typeof subtopicSchema>
export type Topic = z.infer<typeof topicSchema>

export interface CurriculumTopic extends Topic {
  // Resumen base (explicación completa) en Markdown.
  summary: string
}

export const CEFR_LEVEL_NAMES: Record<CefrLevel, string> = {
  A1: 'Principiante',
  A2: 'Elemental',
  B1: 'Intermedio',
  B2: 'Intermedio alto',
  C1: 'Avanzado'
}

export const SKILL_LABELS: Record<Skill, string> = {
  grammar: 'Gramática',
  reading: 'Lectura',
  writing: 'Escritura'
}

// Tópicos planificados para niveles que todavía no tienen contenido (content/roadmap.json).
export const roadmapSchema = z
  .object({
    levels: z.array(
      z
        .object({
          level: z.enum(CEFR_LEVELS),
          topics: z.array(z.object({ title: text, description: text }).strict()).min(1)
        })
        .strict()
    )
  })
  .strict()

export type Roadmap = z.infer<typeof roadmapSchema>
export type PlannedTopic = Roadmap['levels'][number]['topics'][number]

export type TopicMapStatus = 'not-started' | 'locked' | 'current' | 'passed' | 'review'

export interface CurriculumMapTopic extends Topic {
  status: TopicMapStatus
  bestGrade: number | null
  attempts: number
}

export interface CurriculumMapLevel {
  level: CefrLevel
  name: string
  available: boolean
  topics: CurriculumMapTopic[]
  planned: PlannedTopic[]
}

export interface CurriculumMap {
  currentTopicId: string | null
  totalTopics: number
  reviewedCount: number
  levels: CurriculumMapLevel[]
}
