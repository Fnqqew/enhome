// Traducir una oración y la tanda de traducción: si coincide con una referencia corrige la app; si no, Claude.

import { z } from 'zod'
import { graded, text, wrongAnswers, type ExerciseKind } from './kind'
import { findTypo, firstWords, matchesAny, predictedMistake, typoNote } from './text'

// Traducir

const singleGenerated = z.object({
  type: z.literal('translation'),
  instruction: text,
  spanish: text,
  answers: z.array(text).min(1),
  explanation: text,
  wrongAnswers
})
type SingleGenerated = z.infer<typeof singleGenerated>
const singleAnswer = z.object({ type: z.literal('translation'), text: z.string().max(500) })
type SingleAnswer = z.infer<typeof singleAnswer>
export interface SinglePublic {
  type: 'translation'
  instruction: string
  spanish: string
}

export const translation: ExerciseKind<SingleGenerated, SingleGenerated, SinglePublic, SingleAnswer> = {
  type: 'translation',
  label: 'Traducir',
  skill: 'writing',
  long: false,
  generated: singleGenerated,
  answer: singleAnswer,
  prepare: (e) => e,
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, spanish: e.spanish }),
  mainText: (e) => e.spanish,
  grade: (e, a) => {
    if (matchesAny(a.text, e.answers)) return graded(true, e.answers[0], e.explanation)
    if (!a.text.trim()) return graded(false, e.answers[0], e.explanation)
    // Un error previsto se corrige al instante, sin esperar a Claude.
    const mistake = predictedMistake(a.text, e.wrongAnswers)
    if (mistake) return graded(false, e.answers[0], `${mistake.why} ${e.explanation}`)
    const typo = findTypo(a.text, e.answers)
    if (typo) return graded(true, typo.expected, `${typoNote(typo)} ${e.explanation}`, 9)
    return { kind: 'needs-ai' }
  },
  empty: (e) => ({ type: e.type, text: '' }),
  retry: (e, a) => predictedMistake(a.text, e.wrongAnswers)?.why ?? translation.hint(e),
  hint: (e) => `Podés empezar así: «${firstWords(e.answers[0])}…»`,
  guide: ({ language, spanish }) =>
    `translation: spanish es una oración completa en ${spanish} para traducir al ${language}; answers con todas las traducciones correctas y naturales que se te ocurran (de 2 a 6, con y sin contracciones); wrongAnswers con 1 a 3 traducciones equivocadas típicas de hispanohablantes (calcos del español), cada una con why.`,
  check: 'translation: answers son traducciones correctas y naturales.',
  review: (e, c) => `${c.head}

Ejercicio de traducción al ${c.target}: «${e.spanish}»
Traducciones de referencia: ${e.answers.map((a) => `«${a}»`).join(', ')}
Respuesta del alumno: ${c.answered(0)}

Evaluá si la traducción es aceptable: tiene que conservar el significado y usar bien la gramática del subtema. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas, puntuación ni diferencias de estilo.
Un artículo, un auxiliar o una preposición que falta o sobra es un error de gramática, no de estilo: en ese caso no es aceptable aunque se entienda.

${c.output}`,
  model: (e) => e.answers[0],
  explanation: (e) => e.explanation
}

// Tanda de traducción

const setGenerated = z.object({
  type: z.literal('translation_set'),
  instruction: text,
  // Una historia corta contada en oraciones que el alumno traduce una por una.
  situation: text,
  sentences: z
    .array(z.object({ spanish: text, answers: z.array(text).min(1), explanation: text }))
    .min(3)
    .max(5)
})
type SetGenerated = z.infer<typeof setGenerated>
const setAnswer = z.object({ type: z.literal('translation_set'), texts: z.array(z.string().max(500)).max(5) })
type SetAnswer = z.infer<typeof setAnswer>
export interface SetPublic {
  type: 'translation_set'
  instruction: string
  situation: string
  sentences: { spanish: string }[]
}

export const translationSet: ExerciseKind<SetGenerated, SetGenerated, SetPublic, SetAnswer> = {
  type: 'translation_set',
  label: 'Tanda de traducción',
  skill: 'writing',
  long: true,
  generated: setGenerated,
  answer: setAnswer,
  prepare: (e) => {
    if (e.sentences.some((s) => s.answers.length === 0)) throw new Error('Una oración de la tanda no tiene traducción de referencia.')
    return e
  },
  toPublic: (e) => ({
    type: e.type,
    instruction: e.instruction,
    situation: e.situation,
    sentences: e.sentences.map((s) => ({ spanish: s.spanish }))
  }),
  mainText: (e) => e.situation,
  grade: (e, a) => {
    if (a.texts.every((t) => !t.trim())) return graded(false, null, 'No escribiste ninguna traducción.')
    // Si todas coinciden con una referencia (a lo sumo con un error de tipeo) no hace falta molestar a Claude.
    const results = e.sentences.map((s, i) => {
      const given = a.texts[i] ?? ''
      if (matchesAny(given, s.answers)) return { expected: s.answers[0], note: '' }
      const typo = findTypo(given, s.answers)
      return typo ? { expected: typo.expected, note: typoNote(typo) } : null
    })
    if (!results.every((r) => r !== null)) return { kind: 'needs-ai' }
    const typos = results.filter((r) => r.note).length
    return {
      kind: 'graded',
      feedback: {
        correct: true,
        score: typos > 0 ? 9 : 10,
        correctAnswer: null,
        explanation: e.sentences.map((s) => s.explanation).join(' '),
        parts: e.sentences.map((s, i) => ({
          cue: s.spanish,
          given: a.texts[i] ?? '',
          expected: results[i]!.expected,
          correct: true,
          comment: [results[i]!.note, s.explanation].filter(Boolean).join(' ')
        }))
      }
    }
  },
  empty: (e) => ({ type: e.type, texts: e.sentences.map(() => '') }),
  hint: (e) => `La primera empieza así: «${firstWords(e.sentences[0].answers[0])}…»`,
  guide: ({ language }) =>
    `translation_set: situation describe en español una escena cotidiana; sentences son 3 o 4 oraciones completas de esa misma escena, cada una con spanish, answers (traducciones válidas al ${language}) y explanation. Las oraciones tienen que encadenarse como un relato, no ser frases sueltas.`,
  check: 'translation_set: las oraciones cuentan una misma escena en orden y cada answers es una traducción natural.',
  review: (e, c) => `${c.head}

El alumno tradujo al ${c.target} una tanda de oraciones sobre esta situación: ${e.situation}

${e.sentences
  .map((s, i) => `${i + 1}. Español: «${s.spanish}»\n   Referencias: ${s.answers.map((a) => `«${a}»`).join(', ')}\n   Alumno: ${c.answered(i)}`)
  .join('\n')}

Evaluá cada oración por separado: tiene que conservar el significado y usar bien la gramática del subtema. Las referencias no son las únicas respuestas válidas. No penalices mayúsculas ni puntuación.
Un artículo, un auxiliar o una preposición que falta o sobra es un error de gramática: esa oración no es correcta aunque se entienda.

${c.output}
${c.parts}`,
  parts: (e) => e.sentences.map((s) => ({ cue: s.spanish, expected: s.answers[0] })),
  model: () => null
}
