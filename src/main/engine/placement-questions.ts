// Generación de preguntas del examen inicial con Claude: se generan y después se revisan.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { askClaude, type Ask } from '../claude/bridge'
import {
  applyCorrections,
  CORRECTIONS_GUIDE,
  numbered,
  QUALITY_CHECKLIST,
  REVIEW_EFFORT,
  REVIEW_SYSTEM_PROMPT,
  SELF_CHECK
} from '../claude/quality'
import { shuffleChoices } from '../shuffle'
import type { GeneratedQuestion } from './placement'
import { PLACEMENT_QUESTIONS_PER_TOPIC } from './rules'

const SYSTEM_PROMPT =
  'Sos un evaluador de inglés para hispanohablantes de Argentina. Armás preguntas para un examen de nivelación. Respondé solo con el JSON pedido.'

const MAX_ATTEMPTS = 2

// Mezcla las opciones para que la correcta no quede siempre en la misma posición.
export function shuffleOptions(question: GeneratedQuestion, random: () => number = Math.random): GeneratedQuestion {
  return { ...question, ...shuffleChoices(question.options, question.correctIndex, random) }
}

function schemas(topic: CurriculumTopic) {
  const subtopicIds = topic.subtopics.map((s) => s.id) as [string, ...string[]]
  const question = z.object({
    subtopicId: z.enum(subtopicIds),
    instruction: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1)
  })
  return {
    generation: z.object({ questions: z.array(question).length(PLACEMENT_QUESTIONS_PER_TOPIC) }),
    review: z.object({
      issues: z.array(z.string()),
      corrections: z.array(z.object({ index: z.number().int().min(0), replacement: question }))
    })
  }
}

function topicContext(topic: CurriculumTopic): string {
  const subtopics = topic.subtopics
    .map((s) => `- ${s.id} (día ${s.day}): ${s.title}. ${s.goal} Puntos clave: ${s.keyPoints.join(' ')}`)
    .join('\n')
  return `Tópico: ${topic.title} (${topic.titleEn}), nivel ${topic.level}.
Subtemas:
${subtopics}`
}

const FORMAT_RULES = `- Cada pregunta evalúa un subtema distinto. En subtopicId poné el id exacto del subtema.
- instruction: la consigna en español, breve (por ejemplo: "Elegí la opción correcta para completar la oración.").
- prompt: la oración o el texto en inglés. Marcá el hueco con ___ cuando corresponda. Podés usar un texto corto de 2 o 3 oraciones con una pregunta de comprensión.
- options: exactamente 4 opciones plausibles y distintas entre sí, con una sola correcta sin ambigüedad. Nada de "todas las anteriores".
- correctIndex: la posición (0 a 3) de la opción correcta.
- explanation: por qué es la correcta, en español y en una oración.`

function buildPrompt(topic: CurriculumTopic): string {
  return `${topicContext(topic)}

Generá ${PLACEMENT_QUESTIONS_PER_TOPIC} preguntas de opción múltiple para decidir si el alumno ya domina este tópico.
Reglas:
${FORMAT_RULES}
- Vocabulario acorde al nivel ${topic.level}.

${SELF_CHECK}`
}

function buildReviewPrompt(topic: CurriculumTopic, questions: GeneratedQuestion[]): string {
  return `${topicContext(topic)}

Otro evaluador armó estas preguntas para un examen de nivelación. Revisalas una por una.
${QUALITY_CHECKLIST}

Si una pregunta tiene un error, corregila; si no tiene arreglo, reemplazala por otra del mismo subtema. Las preguntas corregidas tienen que respetar estas reglas:
${FORMAT_RULES}
${CORRECTIONS_GUIDE}

Preguntas a revisar:
${numbered(questions)}`
}

export async function generatePlacementQuestions(topic: CurriculumTopic, ask: Ask = askClaude): Promise<GeneratedQuestion[]> {
  const schema = schemas(topic)

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { questions } = await ask({ systemPrompt: SYSTEM_PROMPT, prompt: buildPrompt(topic), schema: schema.generation })
      const review = await ask({ systemPrompt: REVIEW_SYSTEM_PROMPT, prompt: buildReviewPrompt(topic, questions), schema: schema.review, effort: REVIEW_EFFORT })
      if (review.issues.length > 0) {
        console.info(`[placement] La revisión encontró ${review.issues.length} problema(s):\n- ${review.issues.join('\n- ')}`)
      }
      const reviewed = applyCorrections(questions, review.corrections)
      for (const q of reviewed) {
        if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) {
          throw new Error('Claude generó opciones repetidas.')
        }
      }
      return reviewed.map((q) => shuffleOptions(q))
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
