// Generación de pruebas con Claude: un evaluador arma las preguntas y un revisor las corrige.

import { z } from 'zod'
import type { CefrLevel, CurriculumTopic, Subtopic } from '../../shared/curriculum'
import type { ExamKind, ExamQuestion } from '../../shared/exams'
import { generatedExerciseSchema, type ExerciseType, type GeneratedExercise } from '../../shared/exercises'
import { askClaude, type Ask } from '../claude/bridge'
import { CORRECTIONS_GUIDE, QUALITY_CHECKLIST, REVIEW_EFFORT, REVIEW_SYSTEM_PROMPT, SELF_CHECK } from '../claude/quality'
import { prepareExercise } from '../practice/exercises'
import { FORMAT_GUIDE } from '../practice/generation'
import { MAX_DROPPED_ITEMS } from './rules'

export interface ExamRequestItem {
  topic: CurriculumTopic
  subtopic: Subtopic
  type: ExerciseType
}

export interface ExamRequest {
  kind: ExamKind
  level: CefrLevel
  items: ExamRequestItem[]
  focusNotes: string[]
}

export type ExamGenerator = (request: ExamRequest) => Promise<ExamQuestion[]>

const TIMEOUT_MS = 360_000
const MAX_ATTEMPTS = 2

const SYSTEM_PROMPT =
  'Sos un evaluador de inglés para hispanohablantes de Argentina. Armás pruebas justas, claras y sin ambigüedades. Respondé solo con el JSON pedido.'

const DIFFICULTY: Record<ExamKind, string> = {
  weekly:
    'Es el examen semanal que decide si el alumno aprueba el tópico (se aprueba con 8 sobre 10): exigencia real acorde al nivel, sin trampas, cubriendo los puntos clave de cada subtema.',
  mock: 'Es un simulacro de práctica: un poco más fácil que el examen real, para que el alumno mida cómo va.'
}

const generationSchema = z.object({
  items: z.array(z.object({ index: z.number().int().min(0), exercise: generatedExerciseSchema }))
})
const reviewSchema = z.object({
  issues: z.array(z.string()),
  corrections: z.array(z.object({ index: z.number().int().min(0), replacement: generatedExerciseSchema }))
})

function context(request: ExamRequest): string {
  const seen = new Set<string>()
  const lines = request.items.flatMap(({ topic, subtopic }) => {
    const key = `${topic.id}/${subtopic.id}`
    if (seen.has(key)) return []
    seen.add(key)
    return [`- ${topic.title} › ${subtopic.title} (${topic.level}). Objetivo: ${subtopic.goal} Puntos clave: ${subtopic.keyPoints.join(' ')}`]
  })
  return `Contenidos que evalúa:\n${lines.join('\n')}`
}

const label = (item: ExamRequestItem, index: number): string => `#${index} · ${item.topic.title} › ${item.subtopic.title} · ${item.type}`

export function buildExamPrompt(request: ExamRequest): string {
  const notes = request.focusNotes.length > 0 ? `\nTené en cuenta:\n${request.focusNotes.map((n) => `- ${n}`).join('\n')}\n` : ''
  return `${context(request)}

${DIFFICULTY[request.kind]}
${notes}
Generá exactamente estas ${request.items.length} preguntas, con el subtema y el tipo indicados:
${request.items.map(label).join('\n')}

${FORMAT_GUIDE}

Devolvé en items un objeto por pregunta: index es su número (#) y exercise tiene el formato de su tipo. No repitas oraciones entre preguntas y que ninguna pregunta revele la respuesta de otra.

${SELF_CHECK}`
}

export function buildExamReviewPrompt(request: ExamRequest, generated: (GeneratedExercise | undefined)[]): string {
  const body = generated.flatMap((exercise, i) => (exercise ? [`${label(request.items[i], i)}: ${JSON.stringify(exercise)}`] : [])).join('\n')
  return `${context(request)}

Otro evaluador armó estas preguntas para ${request.kind === 'weekly' ? 'un examen semanal' : 'un simulacro'}. Revisalas una por una.
${QUALITY_CHECKLIST}
- Cada pregunta evalúa el subtema indicado y respeta el formato de su tipo.
- No hay preguntas repetidas ni una pregunta que revele la respuesta de otra.

Si una pregunta tiene un error, corregila; si no tiene arreglo, reemplazala por otra del mismo tipo y subtema.
${CORRECTIONS_GUIDE}

${FORMAT_GUIDE}

Preguntas a revisar:
${body}`
}

export async function generateExam(request: ExamRequest, ask: Ask = askClaude): Promise<ExamQuestion[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { items } = await ask({ systemPrompt: SYSTEM_PROMPT, prompt: buildExamPrompt(request), schema: generationSchema, timeoutMs: TIMEOUT_MS })
      // Cada pregunta se ubica por su número y tiene que ser del tipo pedido.
      const generated = request.items.map((plan, i): GeneratedExercise | undefined => {
        const exercise = items.find((item) => item.index === i)?.exercise
        return exercise?.type === plan.type ? exercise : undefined
      })

      const review = await ask({
        systemPrompt: REVIEW_SYSTEM_PROMPT,
        prompt: buildExamReviewPrompt(request, generated),
        schema: reviewSchema,
        effort: REVIEW_EFFORT,
        timeoutMs: TIMEOUT_MS
      })
      if (review.issues.length > 0) {
        console.info(`[exams] La revisión encontró ${review.issues.length} problema(s):\n- ${review.issues.join('\n- ')}`)
      }
      for (const { index, replacement } of review.corrections) {
        if (index < generated.length && replacement.type === request.items[index].type) generated[index] = replacement
      }

      const questions = request.items.flatMap((plan, i): ExamQuestion[] => {
        const exercise = generated[i]
        if (!exercise) return []
        try {
          return [{ topicId: plan.topic.id, subtopicId: plan.subtopic.id, exercise: prepareExercise(exercise) }]
        } catch {
          return []
        }
      })
      const dropped = request.items.length - questions.length
      if (dropped > MAX_DROPPED_ITEMS) throw new Error(`Claude no generó suficientes preguntas válidas (faltan ${dropped}).`)
      return questions
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
