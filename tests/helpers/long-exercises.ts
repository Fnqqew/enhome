// Ejemplos de los ejercicios largos (tanda, conversación y situación) para los tests.

import type { ExerciseAnswer, GeneratedExercise } from '../../src/shared/exercises'

export type LongType = 'translation_set' | 'dialogue' | 'roleplay'
type Long = Extract<GeneratedExercise, { type: LongType }>

export function longSample(type: LongType, n: number | string): Long {
  switch (type) {
    case 'translation_set':
      return {
        type,
        instruction: 'i',
        situation: `Escena ${n}`,
        sentences: [
          { spanish: `Hoy trabajo ${n}.`, answers: [`I work today ${n}.`], explanation: 'x' },
          { spanish: 'Mi hermana estudia.', answers: ['My sister studies.'], explanation: 'x' },
          { spanish: 'Somos amigos.', answers: ['We are friends.'], explanation: 'x' }
        ]
      }
    case 'dialogue':
      return {
        type,
        instruction: 'i',
        situation: `Charla ${n}`,
        script: [
          { role: 'other', speaker: 'Ana', text: 'Hi! How are you?' },
          { role: 'you', cue: 'Saludá y decí cómo estás', sample: 'Hi Ana, I am fine, thanks.' },
          { role: 'other', speaker: 'Ana', text: 'Where are you from?' },
          { role: 'you', cue: 'Decí de dónde sos', sample: 'I am from Rosario.' }
        ]
      }
    case 'roleplay':
      return {
        type,
        instruction: 'i',
        situation: `Trámite ${n}`,
        goal: 'Pedir un turno',
        steps: [
          { cue: 'Saludá', sample: 'Good morning.' },
          { cue: 'Pedí un turno', sample: 'I would like an appointment, please.' },
          { cue: 'Agradecé', sample: 'Thank you very much.' }
        ]
      }
  }
}

export function longRightAnswer(e: Long): ExerciseAnswer {
  switch (e.type) {
    case 'translation_set':
      return { type: e.type, texts: e.sentences.map((s) => s.answers[0]) }
    case 'dialogue':
      return { type: e.type, texts: e.script.flatMap((line) => (line.role === 'you' ? [line.sample] : [])) }
    case 'roleplay':
      return { type: e.type, texts: e.steps.map((s) => s.sample) }
  }
}
