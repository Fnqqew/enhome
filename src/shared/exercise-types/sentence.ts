// Ejercicios de una oración que se corrigen al instante: completar, ordenar y corregir el error.

import { z } from 'zod'
import { shuffled } from '../shuffle'
import { graded, text, type ExerciseKind } from './kind'
import { matchesAny, normalize, tokenize } from './text'

// Completar

const fillGenerated = z.object({
  type: z.literal('fill_blank'),
  instruction: text,
  sentence: text,
  hint: z.string(),
  answers: z.array(text).min(1),
  explanation: text
})
type FillGenerated = z.infer<typeof fillGenerated>
const fillAnswer = z.object({ type: z.literal('fill_blank'), text: z.string().max(200) })
type FillAnswer = z.infer<typeof fillAnswer>
export interface FillPublic {
  type: 'fill_blank'
  instruction: string
  sentence: string
  hint: string
}

export const fillBlank: ExerciseKind<FillGenerated, FillGenerated, FillPublic, FillAnswer> = {
  type: 'fill_blank',
  label: 'Completar',
  skill: 'grammar',
  long: false,
  generated: fillGenerated,
  answer: fillAnswer,
  prepare: (e) => {
    if (e.sentence.split('___').length !== 2) throw new Error('El ejercicio de completar tiene que tener exactamente un ___.')
    if (e.answers.some((a) => a.includes('___'))) throw new Error('Una respuesta de completar contiene el hueco.')
    return e
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, sentence: e.sentence, hint: e.hint }),
  mainText: (e) => e.sentence,
  grade: (e, a) => graded(matchesAny(a.text, e.answers), e.sentence.replace('___', e.answers[0]), e.explanation),
  empty: (e) => ({ type: e.type, text: '' }),
  hint: (e) => {
    const answer = e.answers[0]
    return `La respuesta empieza con «${answer[0]}» y tiene ${answer.length} ${answer.length === 1 ? 'carácter' : 'caracteres'}.`
  },
  guide: ({ language }) =>
    `fill_blank: sentence en ${language} con exactamente un ___; hint con una pista breve entre paréntesis (por ejemplo, el infinitivo del verbo) o vacío; answers con todas las variantes válidas (con y sin contracción o apóstrofo cuando el idioma las tenga).`,
  check: 'fill_blank: el hueco admite solo las respuestas de answers, y answers incluye todas las variantes válidas (con y sin contracción).'
}

// Ordenar la oración

const orderGenerated = z.object({
  type: z.literal('word_order'),
  instruction: text,
  sentence: text,
  alternatives: z.array(text),
  translation: text,
  explanation: text
})
type OrderGenerated = z.infer<typeof orderGenerated>
type OrderStored = OrderGenerated & { tokens: string[] }
const orderAnswer = z.object({ type: z.literal('word_order'), tokens: z.array(z.string().max(60)).max(40) })
type OrderAnswer = z.infer<typeof orderAnswer>
export interface OrderPublic {
  type: 'word_order'
  instruction: string
  tokens: string[]
  translation: string
}

export const wordOrder: ExerciseKind<OrderGenerated, OrderStored, OrderPublic, OrderAnswer> = {
  type: 'word_order',
  label: 'Ordenar la oración',
  skill: 'grammar',
  long: false,
  generated: orderGenerated,
  answer: orderAnswer,
  prepare: (e, random) => {
    const tokens = tokenize(e.sentence)
    if (tokens.length < 3) throw new Error('La oración para ordenar es demasiado corta.')
    let mixed = shuffled(tokens, random)
    if (mixed.join(' ') === tokens.join(' ')) mixed = [...tokens.slice(1), tokens[0]]
    return { ...e, tokens: mixed }
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, tokens: e.tokens, translation: e.translation }),
  mainText: (e) => e.sentence,
  grade: (e, a) => graded(matchesAny(a.tokens.join(' '), [e.sentence, ...e.alternatives]), e.sentence, e.explanation),
  empty: (e) => ({ type: e.type, tokens: [] }),
  hint: (e) => `La oración empieza con «${tokenize(e.sentence).slice(0, 2).join(' ')}».`,
  guide: ({ language }) =>
    `word_order: sentence es una oración correcta en ${language} de 5 a 12 palabras (el alumno la arma con las palabras mezcladas); alternatives con otros órdenes válidos o vacío; translation es su traducción al español.`,
  check: 'word_order: la oración es correcta y alternatives incluye los otros órdenes válidos.'
}

// Corregir el error

const fixGenerated = z.object({
  type: z.literal('error_correction'),
  instruction: text,
  sentence: text,
  answers: z.array(text).min(1),
  explanation: text
})
type FixGenerated = z.infer<typeof fixGenerated>
const fixAnswer = z.object({ type: z.literal('error_correction'), text: z.string().max(500) })
type FixAnswer = z.infer<typeof fixAnswer>
export interface FixPublic {
  type: 'error_correction'
  instruction: string
  sentence: string
}

function firstDifferentWord(wrong: string, right: string): string | null {
  const a = tokenize(wrong)
  const b = tokenize(right)
  for (let i = 0; i < a.length; i++) {
    if (normalize(a[i]) !== normalize(b[i] ?? '')) return a[i]
  }
  return null
}

export const errorCorrection: ExerciseKind<FixGenerated, FixGenerated, FixPublic, FixAnswer> = {
  type: 'error_correction',
  label: 'Corregir el error',
  skill: 'grammar',
  long: false,
  generated: fixGenerated,
  answer: fixAnswer,
  prepare: (e) => {
    // Si la oración «con error» ya coincide con la corrección, no hay nada que corregir.
    if (matchesAny(e.sentence, e.answers)) throw new Error('La oración para corregir no tiene ningún error.')
    return e
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, sentence: e.sentence }),
  mainText: (e) => e.sentence,
  grade: (e, a) => graded(matchesAny(a.text, e.answers), e.answers[0], e.explanation),
  empty: (e) => ({ type: e.type, text: '' }),
  hint: (e) => {
    const word = firstDifferentWord(e.sentence, e.answers[0])
    return word ? `Fijate en «${word}».` : 'Revisá el verbo y los artículos de la oración.'
  },
  guide: ({ language }) =>
    `error_correction: sentence en ${language} con un solo error relacionado con el subtema; answers con la oración corregida y sus variantes válidas.`,
  check: 'error_correction: la oración tiene exactamente un error y answers lo corrige.'
}
