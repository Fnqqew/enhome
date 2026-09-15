// Carga y valida el temario base desde la carpeta content/.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CEFR_LEVELS, roadmapSchema, topicSchema, type CurriculumTopic, type Roadmap, type Topic } from '../../shared/curriculum'

export class CurriculumError extends Error {}

const LEVEL_RANK = new Map<string, number>(CEFR_LEVELS.map((level, i) => [level, i]))

export function compareTopics(a: Topic, b: Topic): number {
  return LEVEL_RANK.get(a.level)! - LEVEL_RANK.get(b.level)! || a.order - b.order
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function loadCurriculum(dir: string): CurriculumTopic[] {
  const topics: CurriculumTopic[] = []

  for (const level of CEFR_LEVELS) {
    const levelDir = join(dir, level)
    if (!existsSync(levelDir)) continue

    for (const entry of readdirSync(levelDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const topicDir = join(levelDir, entry.name)
      const where = `${level}/${entry.name}`

      let topic: Topic
      try {
        topic = topicSchema.parse(JSON.parse(readFileSync(join(topicDir, 'topic.json'), 'utf8')))
      } catch (err) {
        throw new CurriculumError(`${where}/topic.json es inválido: ${message(err)}`)
      }
      if (topic.level !== level) {
        throw new CurriculumError(`${where}/topic.json dice nivel ${topic.level} pero está en la carpeta ${level}`)
      }

      const summaryPath = join(topicDir, 'resumen.md')
      if (!existsSync(summaryPath)) throw new CurriculumError(`${where}: falta resumen.md`)
      topics.push({ ...topic, summary: readFileSync(summaryPath, 'utf8') })
    }
  }

  validateCurriculum(topics)
  return topics.sort(compareTopics)
}

// El plan de niveles futuros es opcional.
export function loadRoadmap(dir: string): Roadmap {
  const path = join(dir, 'roadmap.json')
  if (!existsSync(path)) return { levels: [] }
  try {
    return roadmapSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (err) {
    throw new CurriculumError(`roadmap.json es inválido: ${message(err)}`)
  }
}

// Reglas que el esquema no puede ver solo: relaciones entre tópicos y estructura del resumen.
export function validateCurriculum(topics: CurriculumTopic[]): void {
  const problems: string[] = []
  const byId = new Map<string, CurriculumTopic>()

  for (const topic of topics) {
    if (byId.has(topic.id)) problems.push(`Id de tópico repetido: ${topic.id}`)
    byId.set(topic.id, topic)
  }

  for (const level of CEFR_LEVELS) {
    const orders = topics.filter((t) => t.level === level).map((t) => t.order).sort((a, b) => a - b)
    if (orders.some((order, i) => order !== i + 1)) {
      problems.push(`${level}: el orden de los tópicos tiene que ser 1..${orders.length} sin saltos (hay ${orders.join(', ')})`)
    }
  }

  for (const topic of topics) {
    const days = topic.subtopics.map((s) => s.day).sort((a, b) => a - b)
    if (days.join(',') !== '1,2,3,4,5') problems.push(`${topic.id}: los subtemas tienen que cubrir los días 1 a 5`)

    if (new Set(topic.subtopics.map((s) => s.id)).size !== topic.subtopics.length) {
      problems.push(`${topic.id}: hay ids de subtema repetidos`)
    }

    for (const id of topic.prerequisites) {
      const prerequisite = byId.get(id)
      if (!prerequisite) problems.push(`${topic.id}: el prerrequisito ${id} no existe`)
      else if (compareTopics(prerequisite, topic) >= 0) problems.push(`${topic.id}: el prerrequisito ${id} tiene que estar antes en el temario`)
    }

    for (let day = 1; day <= 5; day++) {
      if (!new RegExp(`^## Día ${day}\\b`, 'm').test(topic.summary)) {
        problems.push(`${topic.id}: al resumen le falta la sección "## Día ${day}"`)
      }
    }
  }

  if (problems.length > 0) throw new CurriculumError(problems.join('\n'))
}
