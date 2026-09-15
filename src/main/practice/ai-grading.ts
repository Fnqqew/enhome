// Corrección con Claude de traducciones y textos escritos.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import type { ExerciseFeedback, OpenExercise } from '../../shared/exercises'
import { askClaude } from '../claude/bridge'

export interface OpenAnswerRequest {
  topic: CurriculumTopic
  subtopic: Subtopic
  exercise: OpenExercise
  answer: string
}

export type OpenAnswerGrader = (request: OpenAnswerRequest) => Promise<ExerciseFeedback>

// Puntaje mínimo para considerar correcto un texto escrito.
export const WRITING_PASS_SCORE = 6

const SYSTEM_PROMPT =
  'Sos un docente de inglés para hispanohablantes de Argentina. Corregís con precisión y de forma alentadora. Respondé solo con el JSON pedido.'

const reviewSchema = z.object({
  acceptable: z.boolean(),
  score: z.number().int().min(0).max(10),
  correctedText: z.string(),
  comments: z.string().min(1),
  mistakes: z.array(z.object({ fragment: z.string(), correction: z.string(), explanation: z.string() })).max(5)
})

const OUTPUT_GUIDE = `Devolvé:
- acceptable: true si la respuesta es correcta en lo esencial.
- score: de 0 a 10.
- correctedText: la respuesta del alumno corregida con los cambios mínimos necesarios (igual si no hay errores).
- comments: devolución breve y alentadora en español rioplatense (2 o 3 oraciones), empezando por algo que hizo bien.
- mistakes: hasta 5 errores concretos, con fragment copiado tal cual lo escribió el alumno, correction y una explanation breve en español. Vacío si no hay errores.`

export function buildReviewPrompt({ topic, subtopic, exercise, answer }: OpenAnswerRequest): string {
  const context = `Tópico: ${topic.title}, nivel ${topic.level}. Subtema: ${subtopic.title}.
Puntos clave del subtema:
${subtopic.keyPoints.map((p) => `- ${p}`).join('\n')}`

  if (exercise.type === 'translation') {
    return `${context}

Ejercicio de traducción al inglés: «${exercise.spanish}»
Traducciones de referencia: ${exercise.answers.map((a) => `«${a}»`).join(', ')}
Respuesta del alumno: «${answer}»

Evaluá si la traducción es aceptable: tiene que conservar el significado y usar bien la gramática del subtema. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas, puntuación ni diferencias de estilo.

${OUTPUT_GUIDE}`
  }

  return `${context}

Consigna de escritura: ${exercise.task}
Qué tenía que incluir:
${exercise.guidance.map((g) => `- ${g}`).join('\n')}
Extensión pedida: entre ${exercise.minWords} y ${exercise.maxWords} palabras.
Respuesta modelo (solo orientativa): «${exercise.sampleAnswer}»

Texto del alumno:
«${answer}»

Criterios de corrección:
1. Uso correcto de lo que practica el subtema (40 %).
2. Gramática y ortografía en general (25 %).
3. Cumple la consigna y los puntos pedidos (25 %).
4. Vocabulario y claridad acordes al nivel ${topic.level} (10 %).
Si la extensión está muy por fuera de lo pedido, mencionalo y descontá en el criterio 3.

${OUTPUT_GUIDE}`
}

export async function gradeOpenAnswer(request: OpenAnswerRequest): Promise<ExerciseFeedback> {
  const review = await askClaude({ systemPrompt: SYSTEM_PROMPT, prompt: buildReviewPrompt(request), schema: reviewSchema })
  const { exercise } = request
  const isTranslation = exercise.type === 'translation'
  return {
    correct: isTranslation ? review.acceptable : review.score >= WRITING_PASS_SCORE,
    score: review.score,
    correctAnswer: isTranslation ? exercise.answers[0] : exercise.sampleAnswer,
    explanation: isTranslation ? exercise.explanation : '',
    review: { correctedText: review.correctedText, comments: review.comments, mistakes: review.mistakes }
  }
}
