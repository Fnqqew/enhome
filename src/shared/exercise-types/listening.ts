// Escuchar y hablar: dictado, escucha de un diálogo, pares mínimos y repetir (shadowing).
// El texto que se escucha viaja en la vista del alumno (la voz se genera en su compu) pero la pantalla
// no lo muestra hasta que responde.

import { z } from 'zod'
import { choiceIndex, graded, text, type ExerciseKind } from './kind'
import { findTypo, firstWords, matchesAny, normalize, typoNote } from './text'
import { shuffleChoices } from '../shuffle'
import { assertDistinct } from './choice'

// Dictado

const dictationGenerated = z.object({
  type: z.literal('dictation'),
  instruction: text,
  sentence: text,
  // Otras formas de escribir lo mismo (contracciones, números en letras).
  alternatives: z.array(text),
  translation: text,
  explanation: text
})
type DictationGenerated = z.infer<typeof dictationGenerated>
const dictationAnswer = z.object({ type: z.literal('dictation'), text: z.string().max(500) })
type DictationAnswer = z.infer<typeof dictationAnswer>
export interface DictationPublic {
  type: 'dictation'
  instruction: string
  // Lo que se escucha (no se muestra hasta responder).
  audio: string
  translation: string
}

export const dictation: ExerciseKind<DictationGenerated, DictationGenerated, DictationPublic, DictationAnswer> = {
  type: 'dictation',
  label: 'Dictado',
  skill: 'listening',
  long: false,
  generated: dictationGenerated,
  answer: dictationAnswer,
  prepare: (e) => {
    if (e.sentence.split(/\s+/).length < 3) throw new Error('La oración del dictado es demasiado corta.')
    return e
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, audio: e.sentence, translation: e.translation }),
  mainText: (e) => e.sentence,
  grade: (e, a) => {
    const accepted = [e.sentence, ...e.alternatives]
    if (matchesAny(a.text, accepted)) return graded(true, e.sentence, e.explanation)
    const typo = findTypo(a.text, accepted)
    if (typo) return graded(true, e.sentence, `${typoNote(typo)} ${e.explanation}`, 9)
    return graded(false, e.sentence, e.explanation)
  },
  empty: (e) => ({ type: e.type, text: '' }),
  retry: (e) => `Son ${e.sentence.split(/\s+/).length} palabras. Escuchala de nuevo, más despacio.`,
  hint: (e) => `Empieza con «${firstWords(e.sentence)}…»`,
  guide: ({ language }) =>
    `dictation: sentence es una oración natural en ${language} de 5 a 14 palabras que use lo del subtema (el alumno la escucha y la escribe); alternatives con otras formas válidas de escribirla (con o sin contracción, números en letras) o vacío; translation al español; explanation sobre lo que suele confundirse al escucharla.`,
  check: 'dictation: la oración es natural, se entiende al escucharla sin contexto y alternatives no cambia el sentido.'
}

// Escucha (un diálogo o un anuncio, con preguntas)

const question = z.object({ prompt: text, options: z.array(text).min(3).max(4), correctIndex: choiceIndex, explanation: text })
const listeningGenerated = z.object({
  type: z.literal('listening'),
  instruction: text,
  situation: text,
  lines: z
    .array(z.object({ speaker: text, text: text }))
    .min(2)
    .max(10),
  questions: z.array(question).min(2).max(3)
})
type ListeningGenerated = z.infer<typeof listeningGenerated>
const listeningAnswer = z.object({ type: z.literal('listening'), choices: z.array(z.number().int().min(-1).max(3)).max(3) })
type ListeningAnswer = z.infer<typeof listeningAnswer>
export interface ListeningPublic {
  type: 'listening'
  instruction: string
  situation: string
  // Las líneas se escuchan con dos voces; el texto se muestra recién al responder.
  lines: { speaker: string; text: string }[]
  questions: { prompt: string; options: string[] }[]
}

export const listening: ExerciseKind<ListeningGenerated, ListeningGenerated, ListeningPublic, ListeningAnswer> = {
  type: 'listening',
  label: 'Escucha',
  skill: 'listening',
  long: false,
  generated: listeningGenerated,
  answer: listeningAnswer,
  prepare: (e, random) => ({
    ...e,
    questions: e.questions.map((q) => {
      if (q.correctIndex >= q.options.length) throw new Error('La opción correcta está fuera de rango.')
      assertDistinct(q.options)
      return { ...q, ...shuffleChoices(q.options, q.correctIndex, random) }
    })
  }),
  toPublic: (e) => ({
    type: e.type,
    instruction: e.instruction,
    situation: e.situation,
    lines: e.lines,
    questions: e.questions.map((q) => ({ prompt: q.prompt, options: q.options }))
  }),
  mainText: (e) => e.situation,
  grade: (e, a) => {
    const results = e.questions.map((q, i) => a.choices[i] === q.correctIndex)
    const right = results.filter(Boolean).length
    return {
      kind: 'graded',
      feedback: {
        correct: right === results.length,
        score: Math.round((right * 10) / results.length),
        correctAnswer: e.questions.map((q, i) => `${i + 1}. ${q.options[q.correctIndex]}`).join('\n'),
        explanation: e.questions.map((q) => q.explanation).join(' '),
        questionResults: results
      }
    }
  },
  empty: (e) => ({ type: e.type, choices: [] }),
  hint: (e) => `Prestá atención a lo que dice ${e.lines[0].speaker} al principio.`,
  guide: ({ language }) =>
    `listening: situation en español (dónde y quiénes); lines con 4 a 8 líneas de una charla natural en ${language} entre dos personas, cada una { speaker, text } (speaker con el nombre de quien habla, alternando; text con lo que dice); questions con 2 o 3 preguntas en español sobre detalles que solo se saben escuchando, cada una { prompt, options, correctIndex, explanation } (4 opciones, correctIndex es la posición de la correcta, de 0 a 3).`,
  check: 'listening: cada respuesta se deduce de lo que se dice y solo una opción es correcta; la charla suena natural.'
}

// Pares mínimos

const pairGenerated = z.object({
  type: z.literal('minimal_pair'),
  instruction: text,
  pair: z.tuple([text, text]),
  // Cuál de las dos se dice (0 o 1).
  target: z.number().int().min(0).max(1),
  meanings: z.tuple([text, text]),
  explanation: text
})
type PairGenerated = z.infer<typeof pairGenerated>
const pairAnswer = z.object({ type: z.literal('minimal_pair'), choice: z.number().int().min(-1).max(1) })
type PairAnswer = z.infer<typeof pairAnswer>
export interface PairPublic {
  type: 'minimal_pair'
  instruction: string
  pair: [string, string]
  audio: string
}

export const minimalPair: ExerciseKind<PairGenerated, PairGenerated, PairPublic, PairAnswer> = {
  type: 'minimal_pair',
  label: 'Pares mínimos',
  skill: 'listening',
  long: false,
  generated: pairGenerated,
  answer: pairAnswer,
  prepare: (e, random) => {
    if (normalize(e.pair[0]) === normalize(e.pair[1])) throw new Error('Las dos palabras del par son iguales.')
    // Se mezcla de qué lado aparece cada una.
    if (random() < 0.5) return e
    return { ...e, pair: [e.pair[1], e.pair[0]], meanings: [e.meanings[1], e.meanings[0]], target: 1 - e.target }
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, pair: e.pair, audio: e.pair[e.target] }),
  mainText: (e) => e.pair.join(' / '),
  grade: (e, a) =>
    graded(
      a.choice === e.target,
      `${e.pair[e.target]} (${e.meanings[e.target]})`,
      `${e.explanation} ${e.pair[0]}: ${e.meanings[0]} · ${e.pair[1]}: ${e.meanings[1]}.`
    ),
  empty: (e) => ({ type: e.type, choice: -1 }),
  hint: (e) => `Fijate en el sonido que cambia entre «${e.pair[0]}» y «${e.pair[1]}».`,
  guide: ({ language }) =>
    `minimal_pair: pair con dos palabras reales del ${language} que cambian en un solo sonido difícil para hispanohablantes (vocales largas y cortas, nasales, consonantes dobles, s y z); target es cuál se escucha (0 o 1); meanings con la traducción al español de cada una, en el mismo orden (solo la traducción, sin repetir la palabra); explanation breve en español sobre cómo distinguir ese sonido.`,
  check: 'minimal_pair: las dos palabras existen, se diferencian en un solo sonido y meanings las traduce bien.'
}

// Repetí (shadowing)

const shadowGenerated = z.object({
  type: z.literal('shadowing'),
  instruction: text,
  phrase: text,
  translation: text,
  // En qué fijarse al repetir: el ritmo, una palabra que se une con otra, la entonación.
  tip: text
})
type ShadowGenerated = z.infer<typeof shadowGenerated>
const shadowAnswer = z.object({ type: z.literal('shadowing'), text: z.string().max(500) })
type ShadowAnswer = z.infer<typeof shadowAnswer>
export interface ShadowPublic {
  type: 'shadowing'
  instruction: string
  phrase: string
  translation: string
  tip: string
}

// Qué palabras de la frase aparecen, en orden, en lo que se reconoció.
export function matchedWords(expected: string, heard: string): boolean[] {
  const want = normalize(expected).replace(/[,;:]/g, '').split(' ').filter(Boolean)
  const got = normalize(heard)
    .replace(/[,;:.!?]/g, '')
    .split(' ')
    .filter(Boolean)
  // Subsecuencia común más larga, para no castigar una palabra de más o de menos.
  const dp = Array.from({ length: want.length + 1 }, () => new Array<number>(got.length + 1).fill(0))
  for (let i = want.length - 1; i >= 0; i--) {
    for (let j = got.length - 1; j >= 0; j--) dp[i][j] = want[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const matched = new Array<boolean>(want.length).fill(false)
  let i = 0
  let j = 0
  while (i < want.length && j < got.length) {
    if (want[i] === got[j]) {
      matched[i] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return matched
}

export const SHADOWING_PASS = 0.75

export const shadowing: ExerciseKind<ShadowGenerated, ShadowGenerated, ShadowPublic, ShadowAnswer> = {
  type: 'shadowing',
  label: 'Repetí',
  skill: 'speaking',
  long: false,
  generated: shadowGenerated,
  answer: shadowAnswer,
  prepare: (e) => e,
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, phrase: e.phrase, translation: e.translation, tip: e.tip }),
  mainText: (e) => e.phrase,
  grade: (e, a) => {
    const matched = matchedWords(e.phrase, a.text)
    const ratio = matched.length ? matched.filter(Boolean).length / matched.length : 0
    const missed = normalize(e.phrase)
      .replace(/[,;:]/g, '')
      .split(' ')
      .filter((_, i) => !matched[i])
    const heard = a.text.trim() ? `Se entendió: «${a.text.trim()}».` : 'No se escuchó nada.'
    const note = missed.length > 0 ? ` Practicá: ${missed.map((w) => `«${w}»`).join(', ')}.` : ' ¡Se entendió todo!'
    return graded(ratio >= SHADOWING_PASS, e.phrase, `${heard}${note} ${e.tip}`, Math.round(ratio * 10))
  },
  empty: (e) => ({ type: e.type, text: '' }),
  hint: (e) => e.tip,
  guide: ({ language }) =>
    `shadowing: phrase es una frase natural en ${language} de 6 a 14 palabras, de las que se dicen todos los días, con lo del subtema (el alumno la escucha y la repite en voz alta); translation al español; tip con un consejo breve en español sobre el ritmo, una unión de palabras o la entonación.`,
  check: 'shadowing: la frase es natural y se dice así en una charla real; el consejo es correcto.'
}
