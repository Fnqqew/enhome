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
