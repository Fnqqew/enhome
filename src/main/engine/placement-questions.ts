// Generación de preguntas del examen inicial con Claude.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { askClaude } from '../claude/bridge'
import type { GeneratedQuestion } from './placement'
import { PLACEMENT_QUESTIONS_PER_TOPIC } from './rules'

const SYSTEM_PROMPT =
  'Sos un evaluador de inglés para hispanohablantes de Argentina. Armás preguntas para un examen de nivelación. Respondé solo con el JSON pedido.'

const MAX_ATTEMPTS = 2

// Mezcla las opciones para que la correcta no quede siempre en la misma posición.
export function shuffleOptions(question: GeneratedQuestion, random: () => number = Math.random): GeneratedQuestion {
  const order = question.options.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { ...question, options: order.map((i) => question.options[i]), correctIndex: order.indexOf(question.correctIndex) }
}

function buildPrompt(topic: CurriculumTopic): string {
  const subtopics = topic.subtopics
    .map((s) => `- ${s.id} (día ${s.day}): ${s.title}. ${s.goal} Puntos clave: ${s.keyPoints.join(' ')}`)
    .join('\n')

  return `Tópico: ${topic.title} (${topic.titleEn}), nivel ${topic.level}.
Subtemas:
${subtopics}

Generá ${PLACEMENT_QUESTIONS_PER_TOPIC} preguntas de opción múltiple para decidir si el alumno ya domina este tópico.
Reglas:
- Cada pregunta evalúa un subtema distinto. En subtopicId poné el id exacto del subtema.
- instruction: la consigna en español, breve (por ejemplo: "Elegí la opción correcta para completar la oración.").
- prompt: la oración o el texto en inglés. Marcá el hueco con ___ cuando corresponda. Podés usar un texto corto de 2 o 3 oraciones con una pregunta de comprensión.
- options: exactamente 4 opciones plausibles y distintas entre sí, con una sola correcta sin ambigüedad. Nada de "todas las anteriores".
- correctIndex: la posición (0 a 3) de la opción correcta.
- explanation: por qué es la correcta, en español y en una oración.
- Vocabulario acorde al nivel ${topic.level}.`
}

export async function generatePlacementQuestions(topic: CurriculumTopic): Promise<GeneratedQuestion[]> {
  const subtopicIds = topic.subtopics.map((s) => s.id) as [string, ...string[]]
  const schema = z.object({
    questions: z
      .array(
        z.object({
          subtopicId: z.enum(subtopicIds),
          instruction: z.string().min(1),
          prompt: z.string().min(1),
          options: z.array(z.string().min(1)).length(4),
          correctIndex: z.number().int().min(0).max(3),
          explanation: z.string().min(1)
        })
      )
      .length(PLACEMENT_QUESTIONS_PER_TOPIC)
  })

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { questions } = await askClaude({ systemPrompt: SYSTEM_PROMPT, prompt: buildPrompt(topic), schema })
      for (const q of questions) {
        if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) {
          throw new Error('Claude generó opciones repetidas.')
        }
      }
      return questions.map((q) => shuffleOptions(q))
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
