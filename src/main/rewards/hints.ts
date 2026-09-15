// Pistas para ejercicios de práctica: ayudan sin revelar la respuesta completa.

import type { StoredExercise } from '../../shared/exercises'
import { tokenize } from '../practice/exercises'
import { normalize } from '../practice/grading'

const quoted = (items: string[]): string => {
  const parts = items.map((item) => `«${item}»`)
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

function firstDifferentWord(wrong: string, right: string): string | null {
  const a = tokenize(wrong)
  const b = tokenize(right)
  for (let i = 0; i < a.length; i++) {
    if (normalize(a[i]) !== normalize(b[i] ?? '')) return a[i]
  }
  return null
}

export function buildHint(exercise: StoredExercise): string {
  switch (exercise.type) {
    case 'multiple_choice': {
      const wrong = exercise.options.filter((_, i) => i !== exercise.correctIndex)
      return `Descartá ${quoted(wrong.slice(0, Math.max(1, exercise.options.length - 2)))}.`
    }
    case 'fill_blank': {
      const answer = exercise.answers[0]
      return `La respuesta empieza con «${answer[0]}» y tiene ${answer.length} ${answer.length === 1 ? 'carácter' : 'caracteres'}.`
    }
    case 'word_order':
      return `La oración empieza con «${tokenize(exercise.sentence).slice(0, 2).join(' ')}».`
    case 'error_correction': {
      const word = firstDifferentWord(exercise.sentence, exercise.answers[0])
      return word ? `Fijate en «${word}».` : 'Revisá el verbo y los artículos de la oración.'
    }
    case 'translation':
      return `Podés empezar así: «${exercise.answers[0].split(/\s+/).slice(0, 2).join(' ')}…»`
    case 'reading':
      return exercise.questions
        .map((q, i) => `Pregunta ${i + 1}: descartá «${q.options.find((_, k) => k !== q.correctIndex)}».`)
        .join(' ')
    case 'writing':
      return `Una forma de empezar: «${exercise.sampleAnswer.split(/(?<=[.!?])\s+/)[0]}»`
  }
}
