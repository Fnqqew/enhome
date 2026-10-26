// Corrección con Claude de todo lo que el alumno escribe: traducciones, tandas, conversaciones,
// situaciones y textos largos.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import type { ExerciseFeedback, ExercisePart, OpenExercise } from '../../shared/exercises'
import { askClaude, prewarmClaude } from '../claude/bridge'
import { kindOf, modelAnswer, partSources, reviewPrompt } from '../../shared/exercise-types'
import { roleSystemPrompt, spanish } from '../claude/quality'
import { languageInfo, type LanguageId } from '../../shared/languages'

export interface OpenAnswerRequest {
  topic: CurriculumTopic
  subtopic: Subtopic
  exercise: OpenExercise
  // Una respuesta por parte: los ejercicios de una sola respuesta traen un elemento.
  answers: string[]
}

export type OpenAnswerGrader = (request: OpenAnswerRequest) => Promise<ExerciseFeedback>

export { WRITING_PASS_SCORE } from '../../shared/exercise-types/production'

const systemPrompt = (language: LanguageId): string => roleSystemPrompt(language, 'docente', 'Corregís con precisión y de forma alentadora.')

const reviewSchema = z.object({
  acceptable: z.boolean(),
  score: z.number().int().min(0).max(10),
  correctedText: z.string(),
  comments: z.string().min(1),
  mistakes: z.array(z.object({ fragment: z.string(), correction: z.string(), explanation: z.string() })).max(5),
  // Solo en los ejercicios de varias partes: una entrada por parte, en orden.
  parts: z
    .array(z.object({ correct: z.boolean(), correction: z.string(), comment: z.string() }))
    .max(5)
    .optional()
})

const outputGuide = (): string => `Devolvé:
- acceptable: true si la respuesta es correcta en lo esencial.
- score: de 0 a 10.
- correctedText: la respuesta del alumno corregida con los cambios mínimos necesarios (igual si no hay errores).
- comments: devolución breve y alentadora en ${spanish()} (2 o 3 oraciones), empezando por algo que hizo bien.
- mistakes: hasta 5 errores concretos, con fragment copiado tal cual lo escribió el alumno, correction y una explanation breve en español. Vacío si no hay errores.

Antes de responder, verificá tu propia corrección: cada error marcado tiene que ser realmente un error (no una variante válida), cada corrección tiene que ser correcta y el puntaje tiene que ser coherente con los errores encontrados.`

const PARTS_GUIDE = `- parts: una entrada por cada parte, en el mismo orden, con correct (si esa parte está bien), correction (esa parte escrita correctamente) y comment (una frase breve en español). Si el alumno dejó una parte vacía, correct es false.
- correctedText: todas las partes corregidas, una por línea.
- score: promedio del desempeño en todas las partes.`

function context({ topic, subtopic }: OpenAnswerRequest): string {
  return `Tópico: ${topic.title}, nivel ${topic.level}. Subtema: ${subtopic.title}.
Puntos clave del subtema:
${subtopic.keyPoints.map((p) => `- ${p}`).join('\n')}`
}

function answered(answers: string[], index: number): string {
  const value = answers[index]?.trim()
  return value ? `«${value}»` : '(no escribió nada)'
}

export function buildReviewPrompt(request: OpenAnswerRequest): string {
  const { exercise, answers } = request
  return reviewPrompt(exercise, {
    head: context(request),
    target: languageInfo(request.topic.language).name,
    level: request.topic.level,
    answered: (index) => answered(answers, index),
    output: outputGuide(),
    parts: PARTS_GUIDE
  })
}

// Qué modelo corrige cada tipo. Medido el 2026-10-16 con tests/live/grading-models: a través de Claude Code
// Haiku acertó 13/13 pero tardó 17 s de promedio y Sonnet 12/13 en 11 s, así que se queda Sonnet.
// Si cambian los tiempos, se vuelve a medir con esa prueba.
export const GRADING_MODEL: Record<OpenExercise['type'], string> = {
  translation: 'sonnet',
  translation_set: 'sonnet',
  dialogue: 'sonnet',
  roleplay: 'sonnet',
  writing: 'sonnet',
  transformation: 'sonnet'
}

// Con esfuerzo bajo la corrección de una traducción baja de 23 s a 12 s con el mismo veredicto (medido el 2026-10-26).
export const GRADING_EFFORT = 'low'

export async function gradeOpenAnswer(request: OpenAnswerRequest, model = GRADING_MODEL[request.exercise.type]): Promise<ExerciseFeedback> {
  const review = await askClaude({
    label: 'corrección',
    model,
    effort: GRADING_EFFORT,
    systemPrompt: systemPrompt(request.topic.language),
    prompt: buildReviewPrompt(request),
    schema: reviewSchema
  })
  return toFeedback(request, review)
}

type Review = z.infer<typeof reviewSchema>

// De la corrección de Claude a la devolución que ve el alumno.
function toFeedback(request: OpenAnswerRequest, review: Review): ExerciseFeedback {
  const { exercise, answers } = request
  const sources = partSources(exercise)

  const parts: ExercisePart[] | undefined =
    sources.length > 0
      ? sources.map((source, i) => ({
          cue: source.cue,
          given: answers[i] ?? '',
          expected: review.parts?.[i]?.correction?.trim() || source.expected,
          // Sin devolución por parte, se cae en el resultado general para no inventar aciertos.
          correct: review.parts?.[i]?.correct ?? review.acceptable,
          comment: review.parts?.[i]?.comment ?? ''
        }))
      : undefined

  const kind = kindOf(exercise.type)
  const passes = kind.passScore !== undefined ? review.score >= kind.passScore : review.acceptable
  return {
    correct: passes,
    score: review.score,
    correctAnswer: modelAnswer(exercise),
    explanation: kind.explanation?.(exercise) ?? '',
    parts,
    review: { correctedText: review.correctedText, comments: review.comments, mistakes: review.mistakes }
  }
}

// Varias respuestas abiertas (las de un examen) en pocos pedidos: de a BATCH_SIZE por pedido y en
// paralelo. Son menos llamadas y, según Karpo y Chernodub (2026), los modelos sobrecorrigen menos
// cuando ven varias juntas. Si una tanda falla o vuelve incompleta, esas se corrigen de a una.
const BATCH_SIZE = 6

export type OpenAnswerBatchGrader = (requests: OpenAnswerRequest[]) => Promise<ExerciseFeedback[]>

export async function gradeOpenBatch(requests: OpenAnswerRequest[]): Promise<ExerciseFeedback[]> {
  if (requests.length <= 1) return Promise.all(requests.map((r) => gradeOpenAnswer(r)))
  const chunks = Array.from({ length: Math.ceil(requests.length / BATCH_SIZE) }, (_, i) => requests.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE))
  const graded = await Promise.all(
    chunks.map(async (chunk) => {
      if (chunk.length === 1) return [await gradeOpenAnswer(chunk[0])]
      try {
        const { results } = await askClaude({
          label: 'corrección · tanda',
          effort: GRADING_EFFORT,
          systemPrompt: systemPrompt(chunk[0].topic.language),
          prompt: `Corregí cada uno de estos ${chunk.length} ejercicios por separado, como si fueran pedidos distintos, y devolvé results con una corrección por ejercicio, en el mismo orden.

${chunk.map((r, i) => `### Ejercicio ${i + 1}\n\n${buildReviewPrompt(r)}`).join('\n\n')}`,
          schema: z.object({ results: z.array(reviewSchema) }),
          timeoutMs: 180_000
        })
        if (results.length !== chunk.length) throw new Error(`La tanda volvió con ${results.length} correcciones de ${chunk.length}.`)
        return chunk.map((r, i) => toFeedback(r, results[i]))
      } catch (err) {
        console.error('[corrección] La tanda falló; se corrige de a una', err)
        return Promise.all(chunk.map((r) => gradeOpenAnswer(r)))
      }
    })
  )
  return graded.flat()
}

// Al empezar una práctica se abre la sesión de corrección, así la primera corrección no paga el arranque.
export function prewarmGrading(language: LanguageId): void {
  prewarmClaude({ model: 'sonnet', effort: GRADING_EFFORT, systemPrompt: systemPrompt(language), schema: reviewSchema })
}
