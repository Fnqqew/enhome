// Corrección con Claude de todo lo que el alumno escribe: traducciones, tandas, conversaciones,
// situaciones y textos largos.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import type { ExerciseFeedback, ExercisePart, OpenExercise } from '../../shared/exercises'
import { askClaude } from '../claude/bridge'

export interface OpenAnswerRequest {
  topic: CurriculumTopic
  subtopic: Subtopic
  exercise: OpenExercise
  // Una respuesta por parte: los ejercicios de una sola respuesta traen un elemento.
  answers: string[]
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
  mistakes: z.array(z.object({ fragment: z.string(), correction: z.string(), explanation: z.string() })).max(5),
  // Solo en los ejercicios de varias partes: una entrada por parte, en orden.
  parts: z
    .array(z.object({ correct: z.boolean(), correction: z.string(), comment: z.string() }))
    .max(5)
    .optional()
})

const OUTPUT_GUIDE = `Devolvé:
- acceptable: true si la respuesta es correcta en lo esencial.
- score: de 0 a 10.
- correctedText: la respuesta del alumno corregida con los cambios mínimos necesarios (igual si no hay errores).
- comments: devolución breve y alentadora en español rioplatense (2 o 3 oraciones), empezando por algo que hizo bien.
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
  const head = context(request)

  switch (exercise.type) {
    case 'translation':
      return `${head}

Ejercicio de traducción al inglés: «${exercise.spanish}»
Traducciones de referencia: ${exercise.answers.map((a) => `«${a}»`).join(', ')}
Respuesta del alumno: ${answered(answers, 0)}

Evaluá si la traducción es aceptable: tiene que conservar el significado y usar bien la gramática del subtema. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas, puntuación ni diferencias de estilo.

${OUTPUT_GUIDE}`

    case 'translation_set':
      return `${head}

El alumno tradujo al inglés una tanda de oraciones sobre esta situación: ${exercise.situation}

${exercise.sentences
  .map((s, i) => `${i + 1}. Español: «${s.spanish}»\n   Referencias: ${s.answers.map((a) => `«${a}»`).join(', ')}\n   Alumno: ${answered(answers, i)}`)
  .join('\n')}

Evaluá cada oración por separado: tiene que conservar el significado y usar bien la gramática del subtema. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas ni puntuación.

${OUTPUT_GUIDE}
${PARTS_GUIDE}`

    case 'dialogue': {
      let turn = 0
      const script = exercise.script
        .map((line) => {
          if (line.role === 'other') return `${line.speaker}: ${line.text}`
          const i = turn++
          return `Alumno (tenía que: ${line.cue})\n   Respuesta modelo: «${line.sample}»\n   Escribió: ${answered(answers, i)}`
        })
        .join('\n')

      return `${head}

El alumno completó sus turnos en esta conversación. Situación: ${exercise.situation}

${script}

Evaluá cada turno del alumno: tiene que responder lo que pide la consigna, sonar natural en una conversación real y usar bien la gramática del subtema. La respuesta modelo es solo una opción válida entre varias.

${OUTPUT_GUIDE}
${PARTS_GUIDE}`
    }

    case 'roleplay':
      return `${head}

El alumno resolvió una situación simulada. Situación: ${exercise.situation}
Objetivo: ${exercise.goal}

${exercise.steps
  .map((s, i) => `${i + 1}. Tenía que: ${s.cue}\n   Respuesta modelo: «${s.sample}»\n   Escribió: ${answered(answers, i)}`)
  .join('\n')}

Evaluá cada paso: tiene que cumplir lo que pide la consigna, ser apropiado para la situación (registro y cortesía) y usar bien la gramática del subtema. La respuesta modelo es solo una opción válida entre varias.

${OUTPUT_GUIDE}
${PARTS_GUIDE}`

    default:
      return `${head}

Consigna de escritura: ${exercise.task}
Qué tenía que incluir:
${exercise.guidance.map((g) => `- ${g}`).join('\n')}
Extensión pedida: entre ${exercise.minWords} y ${exercise.maxWords} palabras.
Respuesta modelo (solo orientativa): «${exercise.sampleAnswer}»

Texto del alumno:
${answered(answers, 0)}

Criterios de corrección:
1. Uso correcto de lo que practica el subtema (40 %).
2. Gramática y ortografía en general (25 %).
3. Cumple la consigna y los puntos pedidos (25 %).
4. Vocabulario y claridad acordes al nivel ${request.topic.level} (10 %).
Si la extensión está muy por fuera de lo pedido, mencionalo y descontá en el criterio 3.

${OUTPUT_GUIDE}`
  }
}

// Las consignas y las respuestas modelo de cada parte, para armar la devolución.
function partSources(exercise: OpenExercise): { cue: string; expected: string }[] {
  switch (exercise.type) {
    case 'translation_set':
      return exercise.sentences.map((s) => ({ cue: s.spanish, expected: s.answers[0] }))
    case 'dialogue':
      return exercise.script.flatMap((line) => (line.role === 'you' ? [{ cue: line.cue, expected: line.sample }] : []))
    case 'roleplay':
      return exercise.steps.map((s) => ({ cue: s.cue, expected: s.sample }))
    default:
      return []
  }
}

function modelAnswer(exercise: OpenExercise): string | null {
  switch (exercise.type) {
    case 'translation':
      return exercise.answers[0]
    case 'writing':
      return exercise.sampleAnswer
    default:
      return null
  }
}

export async function gradeOpenAnswer(request: OpenAnswerRequest): Promise<ExerciseFeedback> {
  const review = await askClaude({ systemPrompt: SYSTEM_PROMPT, prompt: buildReviewPrompt(request), schema: reviewSchema })
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

  const passes = exercise.type === 'writing' ? review.score >= WRITING_PASS_SCORE : review.acceptable
  return {
    correct: passes,
    score: review.score,
    correctAnswer: modelAnswer(exercise),
    explanation: exercise.type === 'translation' ? exercise.explanation : '',
    parts,
    review: { correctedText: review.correctedText, comments: review.comments, mistakes: review.mistakes }
  }
}
