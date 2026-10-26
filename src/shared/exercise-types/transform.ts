// Transformar una oración (pasarla a pasado, a pregunta, a pasiva…) y ordenar las oraciones de un texto.

import { z } from 'zod'
import { shuffled } from '../shuffle'
import { graded, text, wrongAnswers, type ExerciseKind } from './kind'
import { findTypo, firstWords, matchesAny, predictedMistake, typoNote } from './text'

// Transformar

const transformGenerated = z.object({
  type: z.literal('transformation'),
  // Qué cambio hay que hacer, concreto («Pasala a voz pasiva»).
  instruction: text,
  sentence: text,
  answers: z.array(text).min(1),
  explanation: text,
  wrongAnswers
})
type TransformGenerated = z.infer<typeof transformGenerated>
const transformAnswer = z.object({ type: z.literal('transformation'), text: z.string().max(500) })
type TransformAnswer = z.infer<typeof transformAnswer>
export interface TransformPublic {
  type: 'transformation'
  instruction: string
  // La oración de partida (se muestra: es el enunciado).
  source: string
}

export const transformation: ExerciseKind<TransformGenerated, TransformGenerated, TransformPublic, TransformAnswer> = {
  type: 'transformation',
  label: 'Transformar',
  skill: 'grammar',
  long: false,
  generated: transformGenerated,
  answer: transformAnswer,
  prepare: (e) => {
    if (matchesAny(e.sentence, e.answers)) throw new Error('La oración ya está transformada.')
    return e
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, source: e.sentence }),
  mainText: (e) => e.sentence,
  grade: (e, a) => {
    if (matchesAny(a.text, e.answers)) return graded(true, e.answers[0], e.explanation)
    if (!a.text.trim()) return graded(false, e.answers[0], e.explanation)
    const mistake = predictedMistake(a.text, e.wrongAnswers)
    if (mistake) return graded(false, e.answers[0], `${mistake.why} ${e.explanation}`)
    const typo = findTypo(a.text, e.answers)
    if (typo) return graded(true, typo.expected, `${typoNote(typo)} ${e.explanation}`, 9)
    return { kind: 'needs-ai' }
  },
  empty: (e) => ({ type: e.type, text: '' }),
  retry: (e, a) => predictedMistake(a.text, e.wrongAnswers)?.why ?? transformation.hint(e),
  hint: (e) => `Empieza así: «${firstWords(e.answers[0])}…»`,
  guide: ({ language }) =>
    `transformation: instruction en español con un cambio concreto que practica el subtema (pasar a pasado, a negativa, a pregunta, a pasiva, a estilo indirecto, unir dos oraciones…); sentence es la oración de partida en ${language}; answers con todas las versiones transformadas correctas; wrongAnswers con 1 o 2 transformaciones equivocadas típicas, cada una con why; explanation con la regla.`,
  check: 'transformation: la consigna es inequívoca y answers incluye todas las transformaciones válidas.',
  review: (e, c) => `${c.head}

Ejercicio de transformación en ${c.target}. Consigna: ${e.instruction}
Oración de partida: «${e.sentence}»
Respuestas de referencia: ${e.answers.map((a) => `«${a}»`).join(', ')}
Respuesta del alumno: ${c.answered(0)}

Evaluá si hizo el cambio pedido y si la oración resultante es correcta. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas ni puntuación.

${c.output}`,
  model: (e) => e.answers[0],
  explanation: (e) => e.explanation
}

// Ordenar el texto

const reorderGenerated = z.object({
  type: z.literal('reorder_text'),
  instruction: text,
  // Las oraciones en el orden correcto.
  sentences: z.array(text).min(3).max(6),
  translation: text,
  explanation: text
})
type ReorderGenerated = z.infer<typeof reorderGenerated>
type ReorderStored = ReorderGenerated & { order: number[] }
const reorderAnswer = z.object({ type: z.literal('reorder_text'), order: z.array(z.number().int().min(0).max(5)).max(6) })
type ReorderAnswer = z.infer<typeof reorderAnswer>
export interface ReorderPublic {
  type: 'reorder_text'
  instruction: string
  // Las oraciones mezcladas: la respuesta dice en qué orden van (posiciones de esta lista).
  pieces: string[]
}

export const reorderText: ExerciseKind<ReorderGenerated, ReorderStored, ReorderPublic, ReorderAnswer> = {
  type: 'reorder_text',
  label: 'Ordenar el texto',
  skill: 'reading',
  long: false,
  generated: reorderGenerated,
  answer: reorderAnswer,
  prepare: (e, random) => {
    const indices = e.sentences.map((_, i) => i)
    let order = shuffled(indices, random)
    if (order.every((v, i) => v === i)) order = [...indices.slice(1), 0]
    return { ...e, order }
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, pieces: e.order.map((i) => e.sentences[i]) }),
  mainText: (e) => e.sentences[0],
  grade: (e, a) => {
    const chosen = a.order.map((p) => e.order[p])
    const right = chosen.length === e.sentences.length && chosen.every((v, i) => v === i)
    return graded(right, e.sentences.join(' '), `${e.explanation} (${e.translation})`)
  },
  empty: (e) => ({ type: e.type, order: [] }),
  retry: (e, a) => {
    const placed = a.order.filter((piece, position) => e.order[piece] === position).length
    return `Tenés ${placed} de ${e.sentences.length} en su lugar. ${reorderText.hint(e)}`
  },
  hint: (e) => `El texto empieza con «${firstWords(e.sentences[0], 4)}…»`,
  guide: ({ language }) =>
    `reorder_text: sentences con 3 a 5 oraciones en ${language} de un mismo párrafo, en el orden correcto, con conectores y referencias (pronombres, primero, después, por eso) que hagan que el orden sea único; translation con el texto en español; explanation sobre qué pistas marcan el orden.`,
  check: 'reorder_text: el orden correcto es el único posible y las oraciones forman un texto coherente.'
}
