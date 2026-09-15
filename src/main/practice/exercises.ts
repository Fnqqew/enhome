// Preparación de ejercicios generados y vista sin respuestas.

import type { GeneratedExercise, PublicExercise, StoredExercise } from '../../shared/exercises'
import { shuffleChoices, shuffled } from '../shuffle'
import { matchesAny, normalize } from './grading'

export function tokenize(sentence: string): string[] {
  return sentence
    .trim()
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .filter(Boolean)
}

function assertIndex(index: number, length: number): void {
  if (index >= length) throw new Error('La opción correcta está fuera de rango.')
}

function assertDistinct(options: string[]): void {
  if (new Set(options.map((o) => normalize(o))).size !== options.length) throw new Error('Hay opciones repetidas.')
}

// Controles automáticos de lo que el esquema no puede garantizar, y mezcla de opciones y palabras.
export function prepareExercise(exercise: GeneratedExercise, random: () => number = Math.random): StoredExercise {
  switch (exercise.type) {
    case 'multiple_choice':
      assertIndex(exercise.correctIndex, exercise.options.length)
      assertDistinct(exercise.options)
      return { ...exercise, ...shuffleChoices(exercise.options, exercise.correctIndex, random) }
    case 'reading':
      return {
        ...exercise,
        questions: exercise.questions.map((q) => {
          assertIndex(q.correctIndex, q.options.length)
          assertDistinct(q.options)
          return { ...q, ...shuffleChoices(q.options, q.correctIndex, random) }
        })
      }
    case 'fill_blank':
      if (exercise.sentence.split('___').length !== 2) throw new Error('El ejercicio de completar tiene que tener exactamente un ___.')
      if (exercise.answers.some((a) => a.includes('___'))) throw new Error('Una respuesta de completar contiene el hueco.')
      return exercise
    case 'error_correction':
      // Si la oración "con error" ya coincide con la corrección, no hay nada que corregir.
      if (matchesAny(exercise.sentence, exercise.answers)) throw new Error('La oración para corregir no tiene ningún error.')
      return exercise
    case 'word_order': {
      const tokens = tokenize(exercise.sentence)
      if (tokens.length < 3) throw new Error('La oración para ordenar es demasiado corta.')
      let mixed = shuffled(tokens, random)
      if (mixed.join(' ') === tokens.join(' ')) mixed = [...tokens.slice(1), tokens[0]]
      return { ...exercise, tokens: mixed }
    }
    case 'writing':
      if (exercise.minWords > exercise.maxWords) throw new Error('La extensión mínima supera a la máxima.')
      return exercise
    default:
      return exercise
  }
}

export function toPublicExercise(e: StoredExercise): PublicExercise {
  switch (e.type) {
    case 'multiple_choice':
      return { type: e.type, instruction: e.instruction, prompt: e.prompt, options: e.options }
    case 'fill_blank':
      return { type: e.type, instruction: e.instruction, sentence: e.sentence, hint: e.hint }
    case 'word_order':
      return { type: e.type, instruction: e.instruction, tokens: e.tokens, translation: e.translation }
    case 'error_correction':
      return { type: e.type, instruction: e.instruction, sentence: e.sentence }
    case 'translation':
      return { type: e.type, instruction: e.instruction, spanish: e.spanish }
    case 'reading':
      return { type: e.type, instruction: e.instruction, text: e.text, questions: e.questions.map((q) => ({ prompt: q.prompt, options: q.options })) }
    case 'writing':
      return { type: e.type, instruction: e.instruction, task: e.task, minWords: e.minWords, maxWords: e.maxWords, guidance: e.guidance }
  }
}

// El texto principal de un ejercicio, para pedirle a Claude que no lo repita.
export function mainText(e: StoredExercise): string {
  switch (e.type) {
    case 'multiple_choice':
      return e.prompt
    case 'fill_blank':
    case 'word_order':
    case 'error_correction':
      return e.sentence
    case 'translation':
      return e.spanish
    case 'reading':
      return e.text.slice(0, 80)
    case 'writing':
      return e.task
  }
}
