// Ejemplos de ejercicios y un Claude de mentira, compartidos por los tests.

import type { Ask, AskOptions } from '../../src/main/claude/bridge'
import { tokenize } from '../../src/main/practice/exercises'
import type { ExerciseAnswer, ExerciseType, GeneratedExercise, StoredExercise } from '../../src/shared/exercises'
import { longRightAnswer, longSample } from './long-exercises'

// Un ejercicio como lo genera Claude (sin las fichas mezcladas). La marca permite reconocerlo en un pedido.
export function generatedSample(type: ExerciseType, mark: number | string): GeneratedExercise {
  switch (type) {
    case 'multiple_choice':
      return { type, instruction: 'i', prompt: `${mark} She ___ happy.`, options: ['is', 'are', 'am', 'be'], correctIndex: 0, explanation: 'x' }
    case 'fill_blank':
      return { type, instruction: 'i', sentence: `${mark} They ___ here.`, hint: '(be)', answers: ['are'], explanation: 'x' }
    case 'word_order':
      return { type, instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x' }
    case 'error_correction':
      return { type, instruction: 'i', sentence: `She are happy ${mark}.`, answers: [`She is happy ${mark}.`], explanation: 'x' }
    case 'translation':
      return { type, instruction: 'i', spanish: `Soy docente ${mark}.`, answers: [`I am a teacher ${mark}.`], explanation: 'x' }
    case 'reading': {
      const question = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
      return { type, instruction: 'i', text: `Texto ${mark}`, questions: [question, { ...question, prompt: 'q' }] }
    }
    case 'writing':
      return { type, instruction: 'i', task: `Consigna ${mark}`, minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 'Hi! I am Ana.' }
    case 'translation_set':
    case 'dialogue':
    case 'roleplay':
      return longSample(type, mark)
    case 'dictation':
      return { type, instruction: 'i', sentence: `My sister is a teacher ${mark}.`, alternatives: [], translation: 't', explanation: 'x' }
    case 'listening': {
      const question = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'x' }
      return {
        type,
        instruction: 'i',
        situation: `Escucha ${mark}`,
        lines: [
          { speaker: 'Ana', text: 'Hi, how are you?' },
          { speaker: 'Tom', text: 'Fine, thanks.' }
        ],
        questions: [question, { ...question, prompt: 'q' }]
      }
    }
    case 'minimal_pair':
      return { type, instruction: 'i', pair: ['ship', `sheep${mark}`], target: 1, meanings: ['barco', 'oveja'], explanation: 'x' }
    case 'shadowing':
      return { type, instruction: 'i', phrase: `Nice to meet you ${mark}.`, translation: 't', tip: 'Uní meet y you.' }
    case 'transformation':
      return {
        type,
        instruction: 'Pasala a negativa.',
        sentence: `She is happy ${mark}.`,
        answers: [`She is not happy ${mark}.`, `She isn't happy ${mark}.`],
        explanation: 'x'
      }
    case 'reorder_text':
      return { type, instruction: 'i', sentences: [`First ${mark}.`, 'Then we ate.', 'Finally we left.'], translation: 't', explanation: 'x' }
  }
}

// Un ejercicio como queda guardado (el de ordenar palabras con sus fichas mezcladas).
export function sample(type: ExerciseType, mark: number | string): StoredExercise {
  const exercise = generatedSample(type, mark)
  if (exercise.type === 'word_order') return { ...exercise, tokens: ['sister', 'is', 'She', 'my'] }
  if (exercise.type === 'reorder_text') return { ...exercise, order: [2, 0, 1] }
  return exercise as StoredExercise
}

// La respuesta correcta de cada ejercicio guardado.
export function rightAnswer(e: StoredExercise): ExerciseAnswer {
  switch (e.type) {
    case 'multiple_choice':
      return { type: e.type, choice: e.correctIndex }
    case 'fill_blank':
      return { type: e.type, text: e.answers[0] }
    case 'word_order':
      return { type: e.type, tokens: tokenize(e.sentence) }
    case 'error_correction':
    case 'translation':
      return { type: e.type, text: e.answers[0] }
    case 'reading':
      return { type: e.type, choices: e.questions.map((q) => q.correctIndex) }
    case 'writing':
      return { type: e.type, text: 'My name is Juan and I am from Rosario.' }
    case 'translation_set':
    case 'dialogue':
    case 'roleplay':
      return longRightAnswer(e)
    case 'dictation':
      return { type: e.type, text: e.sentence }
    case 'listening':
      return { type: e.type, choices: e.questions.map((q) => q.correctIndex) }
    case 'minimal_pair':
      return { type: e.type, choice: e.target }
    case 'shadowing':
      return { type: e.type, text: e.phrase }
    case 'transformation':
      return { type: e.type, text: e.answers[0] }
    case 'reorder_text':
      // En qué posición de las mezcladas está cada oración, en el orden correcto.
      return { type: e.type, order: e.sentences.map((_, k) => e.order.indexOf(k)) }
  }
}

// Claude de mentira: devuelve las respuestas en orden (un Error se lanza) y anota los pedidos.
export function fakeClaude(responses: unknown[]): { ask: Ask; prompts: string[] } {
  const prompts: string[] = []
  const ask = (async (options: AskOptions<unknown>) => {
    prompts.push(options.prompt)
    const next = responses.shift()
    if (next instanceof Error) throw next
    return options.schema.parse(next)
  }) as Ask
  return { ask, prompts }
}
