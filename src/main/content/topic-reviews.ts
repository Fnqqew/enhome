// Revisión de tópicos desde la app: el alumno corrige el contenido y lo marca como revisado sin tocar
// los archivos. Lo corregido se guarda en la base del curso y pisa a lo de content/ al cargar; en
// desarrollo, además se escribe en content/ para que llegue al repositorio.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { topicSchema, type CurriculumTopic, type Topic } from '../../shared/curriculum'
import type { LanguageId } from '../../shared/languages'
import type { Db } from '../db/database'
import { CurriculumError, validateCurriculum } from './curriculum'

export interface TopicEdit {
  topic: Topic
  summary: string
}

interface ReviewRow {
  topic_id: string
  content: string | null
  reviewed_on: string | null
}

// Aplica sobre el temario de los archivos lo corregido y revisado desde la app.
export function applyTopicReviews(curriculum: CurriculumTopic[], db: Db): CurriculumTopic[] {
  const rows = db.prepare('SELECT * FROM topic_reviews').all() as unknown as ReviewRow[]
  if (rows.length === 0) return curriculum
  const byId = new Map(rows.map((r) => [r.topic_id, r]))
  return curriculum.map((topic) => {
    const row = byId.get(topic.id)
    if (!row) return topic
    let result = topic
    if (row.content) {
      try {
        const edit = JSON.parse(row.content) as TopicEdit
        result = { ...topic, ...topicSchema.parse(edit.topic), id: topic.id, level: topic.level, order: topic.order, summary: edit.summary }
      } catch (err) {
        // Si los archivos cambiaron y lo guardado ya no encaja, se usa lo de los archivos.
        console.warn(`[temario] No se pudo aplicar la revisión de ${topic.id}`, err)
      }
    }
    return { ...result, reviewed: row.reviewed_on !== null || result.reviewed }
  })
}

export function saveTopicReview(
  db: Db,
  curriculum: CurriculumTopic[],
  topicId: string,
  edit: TopicEdit,
  markReviewed: boolean,
  today: string
): CurriculumTopic {
  const original = curriculum.find((t) => t.id === topicId)
  if (!original) throw new CurriculumError('Ese tópico no existe.')

  let topic: Topic
  try {
    // El id, el nivel y el orden no se cambian desde la app: definen el recorrido.
    topic = topicSchema.parse({ ...edit.topic, id: original.id, level: original.level, order: original.order, reviewed: markReviewed })
  } catch (err) {
    throw new CurriculumError(`El tópico tiene un problema: ${err instanceof Error ? err.message : String(err)}`)
  }
  const updated: CurriculumTopic = { ...topic, language: original.language, summary: edit.summary.trim() + '\n' }
  validateCurriculum(curriculum.map((t) => (t.id === topicId ? updated : t)))

  db.prepare(
    `INSERT INTO topic_reviews (topic_id, content, reviewed_on) VALUES (?, ?, ?)
     ON CONFLICT (topic_id) DO UPDATE SET content = excluded.content, reviewed_on = excluded.reviewed_on`
  ).run(topicId, JSON.stringify({ topic, summary: updated.summary }), markReviewed ? today : null)
  return updated
}

// En desarrollo, la corrección también queda en content/ (y así en git).
export function writeTopicFiles(contentDir: string, language: LanguageId, topic: CurriculumTopic): boolean {
  const levelDir = join(contentDir, language, topic.level)
  if (!existsSync(levelDir)) return false
  for (const entry of readdirSync(levelDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(levelDir, entry.name, 'topic.json')
    if (!existsSync(file)) continue
    const current = JSON.parse(readFileSync(file, 'utf8')) as { id?: string }
    if (current.id !== topic.id) continue
    const { language: _language, summary, ...data } = topic
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    writeFileSync(join(levelDir, entry.name, 'resumen.md'), summary)
    return true
  }
  return false
}
