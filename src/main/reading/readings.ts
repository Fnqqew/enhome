// Lecturas graduadas: Claude escribe un texto corto del nivel del alumno, con glosario y preguntas
// de comprensión, que queda guardado para releer.

import { z } from 'zod'
import type { CefrLevel, CurriculumTopic } from '../../shared/curriculum'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { STORY_CHAPTERS, type ReadingSummary, type ReadingView, type StoryView } from '../../shared/reading'
import type { Subtopic } from '../../shared/curriculum'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../claude/quality'
import type { Db } from '../db/database'
import type { Progression } from '../engine/progression'

export class ReadingError extends Error {}

// Extensión del texto según el nivel, en palabras.
export const READING_LENGTH: Record<CefrLevel, [number, number]> = {
  A1: [110, 170],
  A2: [170, 250],
  B1: [250, 360],
  B2: [340, 460],
  C1: [430, 580],
  C2: [500, 700]
}

const readingSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(150),
  glossary: z
    .array(z.object({ term: z.string().min(1), translation: z.string().min(1) }))
    .min(4)
    .max(12),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1)
      })
    )
    .length(4)
})

interface ReadingRow {
  id: number
  level: string
  topic_id: string | null
  title: string
  content: string
  answers: string | null
  score: number | null
  created_on: string
  week_id: number | null
  chapter: number | null
}

export function buildReadingPrompt(topic: CurriculumTopic, seen: CurriculumTopic[], theme: string): string {
  const target = languageInfo(topic.language).promptName
  const [min, max] = READING_LENGTH[topic.level]
  const questionsLanguage = topic.level === 'A1' || topic.level === 'A2' ? 'en español' : `en ${target}`
  return `Escribí una lectura graduada en ${target} para un alumno hispanohablante de nivel ${topic.level}.
Tema: ${theme}. Que sea una historia o una crónica breve, con personajes, algo que pase y un final; entretenida y verosímil.
Extensión: entre ${min} y ${max} palabras, en párrafos cortos (separados por una línea en blanco).
Usá con naturalidad lo que el alumno está estudiando esta semana: ${topic.title} (${topic.targetTitle}) — ${topic.description}
Puede aparecer también lo de tópicos anteriores: ${seen.map((t) => t.title).join(', ')}.
Vocabulario y estructuras del nivel ${topic.level}; como mucho un 5 % de palabras un poco más difíciles, que van al glosario.

Devolvé:
- title: un título corto en ${target}.
- text: el texto.
- glossary: entre 6 y 10 palabras o expresiones que aparecen tal cual en el texto y que pueden costar, con su traducción al ${spanish()} en ese contexto.
- questions: 4 preguntas de comprensión ${questionsLanguage}, con 4 opciones cada una (una sola correcta, que se deduzca del texto), correctIndex y una explanation breve en español que cite el fragmento que la responde.

${selfCheck(topic.language)}`
}

// Un capítulo de la historia de la semana: sigue con los mismos personajes y usa el subtema del día.
export function buildChapterPrompt(topic: CurriculumTopic, subtopic: Subtopic, previous: { title: string; text: string }[], chapter: number): string {
  const target = languageInfo(topic.language).promptName
  const [min, max] = READING_LENGTH[topic.level]
  const questionsLanguage = topic.level === 'A1' || topic.level === 'A2' ? 'en español' : `en ${target}`
  const story =
    previous.length === 0
      ? `Es el capítulo 1: presentá a dos o tres personajes con nombre, un lugar concreto y una situación que va a seguir durante la semana (un viaje, un trabajo nuevo, una mudanza, un misterio chico).`
      : `Seguí la historia con los mismos personajes, el mismo lugar y lo que ya pasó. Los capítulos anteriores:\n\n${previous
          .map((c, i) => `Capítulo ${i + 1}: ${c.title}\n${c.text}`)
          .join('\n\n')}`
  const ending =
    chapter === STORY_CHAPTERS
      ? 'Es el último capítulo: cerrá la historia con un final.'
      : 'Terminá con algo que deje ganas de leer el capítulo siguiente.'
  return `Escribí el capítulo ${chapter} de ${STORY_CHAPTERS} de una historia en ${target} para un alumno hispanohablante de nivel ${topic.level}, que se lee un capítulo por día durante la semana.
${story}
${ending}
Este capítulo usa sobre todo lo del subtema de hoy, con naturalidad: ${subtopic.title}. ${subtopic.goal} Puntos clave: ${subtopic.keyPoints.join(' ')}
Extensión: entre ${min} y ${max} palabras, en párrafos cortos (separados por una línea en blanco). Vocabulario y estructuras del nivel ${topic.level}.
Devolvé:
- title: el título de este capítulo, corto, en ${target}.
- text: el texto del capítulo.
- glossary: entre 6 y 10 palabras o expresiones que aparecen tal cual en el texto y que pueden costar, con su traducción al ${spanish()} en ese contexto.
- questions: 4 preguntas de comprensión ${questionsLanguage} sobre este capítulo, con 4 opciones cada una (una sola correcta), correctIndex y una explanation breve en español que cite el fragmento que la responde.
${selfCheck(topic.language)}`
}

export class Readings {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly language: LanguageId,
    private readonly ask: Ask = askClaude
  ) {}

  list(): ReadingSummary[] {
    const rows = this.db.prepare('SELECT * FROM readings ORDER BY id DESC').all() as unknown as ReadingRow[]
    return rows.map((r) => this.summary(r))
  }

  private summary(r: ReadingRow): ReadingSummary {
    return {
      id: r.id,
      chapter: r.chapter,
      title: r.title,
      level: r.level,
      score: r.score,
      questions: (JSON.parse(r.content) as { questions: unknown[] }).questions.length,
      createdOn: r.created_on
    }
  }

  // La historia de la semana: un capítulo por día (como mucho) y no más adelante que las prácticas hechas.
  story(today: string): StoryView | null {
    const week = this.progression.getState(today).week
    const topic = week ? this.curriculum.find((t) => t.id === week.topicId) : undefined
    if (!week || !topic) return null
    const rows = this.chapters(week.id)
    const last = rows.at(-1)
    const waitReason =
      rows.length >= STORY_CHAPTERS
        ? 'La historia de esta semana terminó: la próxima empieza con el tópico nuevo.'
        : last?.created_on === today
          ? 'Mañana sigue, con el tema de ese día.'
          : rows.length > week.completedUnits
            ? 'Hacé la práctica de hoy y sigue la historia.'
            : null
    return {
      topicTitle: topic.title,
      chapters: rows.map((r) => this.summary(r)),
      next: waitReason ? null : { chapter: rows.length + 1, subtopicTitle: topic.subtopics[rows.length].title },
      waitReason
    }
  }

  async nextChapter(today: string): Promise<ReadingView> {
    const story = this.story(today)
    if (!story?.next) throw new ReadingError(story?.waitReason ?? 'Esta semana no hay historia.')
    const week = this.progression.getState(today).week!
    const topic = this.curriculum.find((t) => t.id === week.topicId)!
    const previous = this.chapters(week.id).map((r) => ({ title: r.title, text: (JSON.parse(r.content) as { text: string }).text }))
    const chapter = story.next.chapter
    const reading = await this.ask({
      label: 'historia',
      effort: 'medium',
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Escribís historias por capítulos claras, entretenidas y sin errores.'),
      prompt: buildChapterPrompt(topic, topic.subtopics[chapter - 1], previous, chapter),
      schema: readingSchema,
      timeoutMs: 240_000
    })
    const lower = reading.text.toLowerCase()
    const glossary = reading.glossary.filter((g) => lower.includes(g.term.toLowerCase()))
    const content = { text: reading.text, glossary, questions: reading.questions }
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO readings (level, topic_id, title, content, created_on, week_id, chapter) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(topic.level, topic.id, reading.title, JSON.stringify(content), today, week.id, chapter)
    return this.get(Number(lastInsertRowid))
  }

  private chapters(weekId: number): ReadingRow[] {
    return this.db.prepare('SELECT * FROM readings WHERE week_id = ? ORDER BY chapter').all(weekId) as unknown as ReadingRow[]
  }

  get(id: number): ReadingView {
    return this.view(this.row(id))
  }

  async generate(theme: string, today: string): Promise<ReadingView> {
    const { topic, seen } = this.context(today)
    const reading = await this.ask({
      label: 'lectura',
      effort: 'medium',
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Escribís lecturas graduadas claras, entretenidas y sin errores.'),
      prompt: buildReadingPrompt(topic, seen, theme),
      schema: readingSchema,
      timeoutMs: 240_000
    })
    // Solo quedan en el glosario las palabras que de verdad aparecen en el texto.
    const lower = reading.text.toLowerCase()
    const glossary = reading.glossary.filter((g) => lower.includes(g.term.toLowerCase()))
    const content = { text: reading.text, glossary, questions: reading.questions }
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO readings (level, topic_id, title, content, created_on) VALUES (?, ?, ?, ?, ?)')
      .run(topic.level, topic.id, reading.title, JSON.stringify(content), today)
    return this.get(Number(lastInsertRowid))
  }

  answer(id: number, answers: number[]): ReadingView {
    const row = this.row(id)
    const { questions } = JSON.parse(row.content) as { questions: { correctIndex: number }[] }
    if (answers.length !== questions.length) throw new ReadingError('Respondé todas las preguntas.')
    const right = questions.filter((q, i) => q.correctIndex === answers[i]).length
    const score = Math.round((right / questions.length) * 10)
    this.db.prepare('UPDATE readings SET answers = ?, score = ? WHERE id = ?').run(JSON.stringify(answers), score, id)
    return this.get(id)
  }

  remove(id: number): ReadingSummary[] {
    this.db.prepare('DELETE FROM readings WHERE id = ?').run(id)
    return this.list()
  }

  // El tópico de la semana (o el último aprobado) y lo visto hasta ahí.
  private context(today: string): { topic: CurriculumTopic; seen: CurriculumTopic[] } {
    const state = this.progression.getState(today)
    const index = Math.max(
      0,
      this.curriculum.findIndex((t) => t.id === state.week?.topicId)
    )
    return { topic: this.curriculum[index], seen: this.curriculum.slice(0, index + 1) }
  }

  private view(row: ReadingRow): ReadingView {
    const content = JSON.parse(row.content) as Pick<ReadingView, 'text' | 'glossary' | 'questions'>
    return {
      id: row.id,
      title: row.title,
      level: row.level,
      topicId: row.topic_id ?? this.curriculum[0].id,
      topicTitle: this.curriculum.find((t) => t.id === row.topic_id)?.title ?? null,
      ...content,
      answers: row.answers ? (JSON.parse(row.answers) as number[]) : null,
      score: row.score,
      createdOn: row.created_on,
      chapter: row.chapter
    }
  }

  private row(id: number): ReadingRow {
    const row = this.db.prepare('SELECT * FROM readings WHERE id = ?').get(id) as ReadingRow | undefined
    if (!row) throw new ReadingError('Esa lectura no existe.')
    return row
  }
}
