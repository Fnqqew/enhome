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
