// Corrección automática de los ejercicios cerrados.

import type { ExerciseAnswer, ExerciseFeedback, StoredExercise } from '../../shared/exercises'

type AnswerOf<T extends ExerciseAnswer['type']> = Extract<ExerciseAnswer, { type: T }>

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will']
]

export function normalize(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[\s.!?;:,"]+$/g, '')
    .replace(/^["¿¡\s]+/, '')
}

// Forma canónica: sin contracciones ni comas, para no penalizar variantes equivalentes.
function canonical(value: string): string {
  let result = normalize(value)
  for (const [pattern, replacement] of CONTRACTIONS) result = result.replace(pattern, replacement)
  return result.replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

export function matchesAny(answer: string, accepted: string[]): boolean {
  const value = canonical(answer)
  return value !== '' && accepted.some((option) => canonical(option) === value)
}

// Distancia de edición con transposiciones («becuase» → «because» es un solo error).
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// Hasta dónde coinciden dos palabras desde el principio y desde el final.
function sharedEnds(a: string, b: string): { start: number; end: number } {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  return { start, end }
}

export interface Typo {
  typed: string
  intended: string
  expected: string
}

// Un error de tipeo, no de gramática: una sola palabra distinta, larga, a un error de distancia y
// sin tocar el final, que es donde están las terminaciones que se practican (works/work, falou/falei).
// Ante la duda devuelve null y corrige Claude.
export function findTypo(answer: string, accepted: string[]): Typo | null {
  const words = canonical(answer).split(' ')
  for (const option of accepted) {
    const expected = canonical(option).split(' ')
    if (expected.length !== words.length) continue
    const differing = expected.flatMap((word, i) => (word === words[i] ? [] : [i]))
    if (differing.length !== 1) continue
    const typed = words[differing[0]]
    const intended = expected[differing[0]]
    if (typed.length < 5 || intended.length < 5 || editDistance(typed, intended) !== 1) continue
    if (sharedEnds(typed, intended).end < 2) continue
    return { typed, intended, expected: option }
  }
  return null
}

const typoNote = (typo: Typo): string => `Ojo con la ortografía: escribiste «${typo.typed}», se escribe «${typo.intended}».`

export type AutoGrade = { kind: 'graded'; feedback: ExerciseFeedback } | { kind: 'needs-ai' }

function graded(correct: boolean, correctAnswer: string, explanation: string): AutoGrade {
  return { kind: 'graded', feedback: { correct, score: correct ? 10 : 0, correctAnswer, explanation } }
}

// Corrige lo que se puede corregir sin IA; la traducción que no coincide y la escritura van a Claude.
export function gradeAuto(exercise: StoredExercise, answer: ExerciseAnswer): AutoGrade {
  if (exercise.type !== answer.type) throw new Error('La respuesta no corresponde al tipo de ejercicio.')

  switch (exercise.type) {
    case 'multiple_choice': {
      const { choice } = answer as AnswerOf<'multiple_choice'>
      return graded(choice === exercise.correctIndex, exercise.options[exercise.correctIndex], exercise.explanation)
    }
    case 'fill_blank': {
      const { text } = answer as AnswerOf<'fill_blank'>
      return graded(matchesAny(text, exercise.answers), exercise.sentence.replace('___', exercise.answers[0]), exercise.explanation)
    }
    case 'word_order': {
      const { tokens } = answer as AnswerOf<'word_order'>
      return graded(matchesAny(tokens.join(' '), [exercise.sentence, ...exercise.alternatives]), exercise.sentence, exercise.explanation)
    }
    case 'error_correction': {
      const { text } = answer as AnswerOf<'error_correction'>
      return graded(matchesAny(text, exercise.answers), exercise.answers[0], exercise.explanation)
    }
    case 'translation': {
      const { text } = answer as AnswerOf<'translation'>
      if (matchesAny(text, exercise.answers)) return graded(true, exercise.answers[0], exercise.explanation)
      if (!text.trim()) return graded(false, exercise.answers[0], exercise.explanation)
      const typo = findTypo(text, exercise.answers)
      if (typo) {
        return { kind: 'graded', feedback: { correct: true, score: 9, correctAnswer: typo.expected, explanation: `${typoNote(typo)} ${exercise.explanation}` } }
      }
      return { kind: 'needs-ai' }
    }
    case 'translation_set': {
      const { texts } = answer as AnswerOf<'translation_set'>
      if (texts.every((t) => !t.trim())) {
        return { kind: 'graded', feedback: { correct: false, score: 0, correctAnswer: null, explanation: 'No escribiste ninguna traducción.' } }
      }
      // Si todas coinciden con una referencia (a lo sumo con un error de tipeo) no hace falta molestar a Claude.
      const results = exercise.sentences.map((s, i) => {
        const given = texts[i] ?? ''
        if (matchesAny(given, s.answers)) return { expected: s.answers[0], note: '' }
        const typo = findTypo(given, s.answers)
        return typo ? { expected: typo.expected, note: typoNote(typo) } : null
      })
      if (results.every((r) => r !== null)) {
        const typos = results.filter((r) => r.note).length
        return {
          kind: 'graded',
          feedback: {
            correct: true,
            score: typos > 0 ? 9 : 10,
            correctAnswer: null,
            explanation: exercise.sentences.map((s) => s.explanation).join(' '),
            parts: exercise.sentences.map((s, i) => ({
              cue: s.spanish,
              given: texts[i] ?? '',
              expected: results[i]!.expected,
              correct: true,
              comment: [results[i]!.note, s.explanation].filter(Boolean).join(' ')
            }))
          }
        }
      }
      return { kind: 'needs-ai' }
    }
    case 'dialogue':
    case 'roleplay': {
      const { texts } = answer as AnswerOf<'dialogue' | 'roleplay'>
      if (texts.every((t) => !t.trim())) {
        return { kind: 'graded', feedback: { correct: false, score: 0, correctAnswer: null, explanation: 'No escribiste ninguna respuesta.' } }
      }
      return { kind: 'needs-ai' }
    }
    case 'reading': {
      const { choices } = answer as AnswerOf<'reading'>
      const results = exercise.questions.map((q, i) => choices[i] === q.correctIndex)
      const right = results.filter(Boolean).length
      return {
        kind: 'graded',
        feedback: {
          correct: right === results.length,
          score: Math.round((right * 10) / results.length),
          correctAnswer: exercise.questions.map((q, i) => `${i + 1}. ${q.options[q.correctIndex]}`).join('\n'),
          explanation: exercise.questions.map((q) => q.explanation).join(' '),
          questionResults: results
        }
      }
    }
    case 'writing': {
      const { text } = answer as AnswerOf<'writing'>
      if (!text.trim()) {
        return { kind: 'graded', feedback: { correct: false, score: 0, correctAnswer: exercise.sampleAnswer, explanation: 'No escribiste nada.' } }
      }
      return { kind: 'needs-ai' }
    }
  }
}
