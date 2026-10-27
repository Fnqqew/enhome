// La misión de la semana: Claude arma una tarea real con su rúbrica a partir del tópico y después
// evalúa lo que el alumno escribió o dijo, criterio por criterio.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { MISSION_AFTER_UNITS, MISSION_PASS_PERCENT, type MissionReview, type MissionTask, type MissionView } from '../../shared/mission'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../claude/quality'
import type { Db } from '../db/database'
import type { Progression } from '../engine/progression'

export class MissionError extends Error {}

const text = z.string().trim().min(1)
const taskSchema = z.object({
  title: text,
  situation: text,
  task: text,
  mode: z.enum(['write', 'speak']),
  checklist: z.array(text).min(2).max(5),
  rubric: z
    .array(z.object({ criterion: text, description: text }))
    .min(3)
    .max(4),
  minWords: z.number().int().min(10).max(300),
  maxWords: z.number().int().min(20).max(500)
})
const reviewSchema = z.object({
  criteria: z.array(z.object({ criterion: text, score: z.number().int().min(0).max(3), comment: text })),
  comments: text,
  correctedText: z.string(),
  nextStep: text
})

interface MissionRow {
  week_id: number
  topic_id: string
  task: string
  answer: string | null
  review: string | null
}

export function buildMissionPrompt(topic: CurriculumTopic, mode: MissionTask['mode']): string {
  const target = languageInfo(topic.language).promptName
  const how =
    mode === 'speak'
      ? `La responde hablando (se graba y se transcribe): algo que se dice en voz alta, como dejar un mensaje de voz, presentarse en una entrevista o explicar un problema. Entre 30 y 60 segundos.`
      : `La responde por escrito: un mail, un mensaje, una reseña, una publicación o una carta, como en la vida real.`
  return `Armá la misión de la semana para un alumno hispanohablante de ${target}, nivel ${topic.level}, que estudió esta semana: ${topic.title} (${topic.targetTitle}). ${topic.description}
Subtemas: ${topic.subtopics.map((s) => s.title).join(', ')}.
Es una tarea real que cierra el tópico y obliga a usar lo de la semana: pedir algo en un restaurante, escribirle a un dueño por un alquiler, dejar un audio a un amigo, reclamar en una tienda. ${how}
Campos, con estos nombres exactos: { title, situation, task, mode, checklist, rubric: [{ criterion, description }], minWords, maxWords }
- title: un título corto en español.
- situation: dónde, con quién y qué pasa, en español (2 o 3 oraciones, con nombres concretos).
- task: qué tiene que producir, en español y concreto.
- mode: "${mode}".
- checklist: de 2 a 5 cosas que la respuesta tiene que incluir (en español), que obliguen a usar lo del tópico.
- rubric: 3 o 4 criterios en español (por ejemplo: cumple la tarea, usa lo del tópico, corrección, registro adecuado), cada uno con qué se espera.
- minWords y maxWords: la extensión esperada según el nivel ${topic.level}.
${selfCheck(topic.language)}`
}

export function buildMissionReviewPrompt(topic: CurriculumTopic, mission: MissionTask, answer: string): string {
  const target = languageInfo(topic.language).promptName
  return `Evaluá la misión de la semana de un alumno hispanohablante de ${target}, nivel ${topic.level} (tópico: ${topic.title}).
Situación: ${mission.situation}
Tarea: ${mission.task}
Tenía que incluir: ${mission.checklist.join('; ')}
${mission.mode === 'speak' ? 'La respondió hablando: lo que sigue es la transcripción automática, así que no penalices puntuación, mayúsculas ni palabras mal reconocidas que suenan parecido.' : 'La respondió por escrito.'}
Respuesta del alumno:
«${answer}»

Rúbrica: puntuá cada criterio de 0 a 3 (0 no lo cumple, 1 poco, 2 bien, 3 muy bien), siendo exigente pero justo para el nivel ${topic.level}:
${mission.rubric.map((r, i) => `${i + 1}. ${r.criterion}: ${r.description}`).join('\n')}
Campos, con estos nombres exactos: { criteria: [{ criterion, score, comment }], comments, correctedText, nextStep }
- criteria: uno por criterio, en el mismo orden, con un comentario breve en ${spanish()} que cite lo que escribió o dijo.
- comments: dos o tres oraciones en ${spanish()}: qué salió bien y qué conviene mejorar.
- correctedText: su respuesta corregida en ${target}, cambiando lo mínimo para que quede correcta y natural.
- nextStep: un consejo concreto en ${spanish()} para la próxima vez.`
}

export class Missions {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly language: LanguageId,
    private readonly ask: Ask = askClaude
  ) {}

  get(today: string): MissionView | null {
    const week = this.progression.getState(today).week
    const topic = week ? this.curriculum.find((t) => t.id === week.topicId) : undefined
    if (!week || !topic) return null
    const row = this.row(week.id)
    const missing = MISSION_AFTER_UNITS - week.completedUnits
    return {
      topicTitle: topic.title,
      mission: row ? (JSON.parse(row.task) as MissionTask) : null,
      answer: row?.answer ?? null,
      review: row?.review ? (JSON.parse(row.review) as MissionReview) : null,
      lockedReason:
        row || missing <= 0
          ? null
          : `Se habilita cuando hagas ${missing === 1 ? 'una práctica más' : `${missing} prácticas más`} de esta semana: así tenés con qué resolverla.`
    }
  }

  // Claude arma la misión de la semana (una sola vez por semana).
  async create(mode: MissionTask['mode'], today: string): Promise<MissionView> {
    const view = this.get(today)
    if (!view) throw new MissionError('Esta semana no hay misión.')
    if (view.lockedReason) throw new MissionError(view.lockedReason)
    if (view.mission) return view
    const week = this.progression.getState(today).week!
    const topic = this.curriculum.find((t) => t.id === week.topicId)!
    const task = await this.ask({
      label: 'misión',
      effort: 'medium',
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Armás tareas reales, claras y a la medida del nivel.'),
      prompt: buildMissionPrompt(topic, mode),
      schema: taskSchema,
      timeoutMs: 120_000
    })
    const mission: MissionTask = { ...task, mode, maxWords: Math.max(task.maxWords, task.minWords) }
    this.db
      .prepare('INSERT OR IGNORE INTO missions (week_id, topic_id, task, created_on) VALUES (?, ?, ?, ?)')
      .run(week.id, topic.id, JSON.stringify(mission), today)
    return this.get(today)!
  }

  // Claude evalúa la respuesta con la rúbrica. Se puede volver a entregar para mejorarla.
  async submit(answer: string, today: string): Promise<MissionView> {
    const clean = answer.trim()
    if (!clean) throw new MissionError('Escribí o grabá tu respuesta.')
    const week = this.progression.getState(today).week
    const row = week ? this.row(week.id) : null
    if (!week || !row) throw new MissionError('Primero pedí la misión de la semana.')
    const topic = this.curriculum.find((t) => t.id === row.topic_id)!
    const mission = JSON.parse(row.task) as MissionTask
    const graded = await this.ask({
      label: 'misión · evaluación',
      effort: 'medium',
      systemPrompt: roleSystemPrompt(this.language, 'evaluador', 'Evaluás con una rúbrica, con exigencia y con justicia.'),
      prompt: buildMissionReviewPrompt(topic, mission, clean),
      schema: reviewSchema,
      timeoutMs: 120_000
    })
    // Un puntaje por criterio de la rúbrica, aunque Claude devuelva de más o de menos.
    const criteria = mission.rubric.map((r, i) => graded.criteria[i] ?? { criterion: r.criterion, score: 0, comment: 'Sin evaluar.' })
    const percent = Math.round((criteria.reduce((sum, c) => sum + c.score, 0) / (criteria.length * 3)) * 100)
    const review: MissionReview = { ...graded, criteria, percent, passed: percent >= MISSION_PASS_PERCENT }
    this.db
      .prepare('UPDATE missions SET answer = ?, review = ?, submitted_on = ? WHERE week_id = ?')
      .run(clean, JSON.stringify(review), today, week.id)
    return this.get(today)!
  }

  private row(weekId: number): MissionRow | null {
    return (this.db.prepare('SELECT * FROM missions WHERE week_id = ?').get(weekId) as MissionRow | undefined) ?? null
  }
}
