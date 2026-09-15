import { describe, expect, it } from 'vitest'
import type { StoredExercise } from '../../src/shared/exercises'
import { gradeAuto, matchesAny, normalize } from '../../src/main/practice/grading'

describe('normalize y matchesAny', () => {
  it('ignora mayúsculas, espacios, puntuación final y comillas tipográficas', () => {
    expect(normalize('  She’s   HAPPY . ')).toBe("she's happy")
  })

  it('acepta contracciones equivalentes', () => {
    expect(matchesAny("She is not at home.", ["She isn't at home."])).toBe(true)
    expect(matchesAny('I cannot swim', ["I can't swim"])).toBe(true)
    expect(matchesAny("They're here", ['They are here'])).toBe(true)
  })

  it('no acepta respuestas vacías ni distintas', () => {
    expect(matchesAny('', ['is'])).toBe(false)
    expect(matchesAny('are', ['is'])).toBe(false)
  })
})

describe('gradeAuto', () => {
  it('opción múltiple', () => {
    const e: StoredExercise = { type: 'multiple_choice', instruction: 'i', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'x' }
    expect(gradeAuto(e, { type: 'multiple_choice', choice: 2 })).toMatchObject({ kind: 'graded', feedback: { correct: true, score: 10 } })
    expect(gradeAuto(e, { type: 'multiple_choice', choice: 0 })).toMatchObject({ kind: 'graded', feedback: { correct: false, correctAnswer: 'c' } })
  })

  it('completar muestra la oración completa como respuesta', () => {
    const e: StoredExercise = { type: 'fill_blank', instruction: 'i', sentence: 'She ___ happy.', hint: '(be)', answers: ['is'], explanation: 'x' }
    expect(gradeAuto(e, { type: 'fill_blank', text: ' IS ' })).toMatchObject({ feedback: { correct: true } })
    expect(gradeAuto(e, { type: 'fill_blank', text: 'are' })).toMatchObject({ feedback: { correct: false, correctAnswer: 'She is happy.' } })
  })

  it('ordenar acepta la oración y sus alternativas', () => {
    const e: StoredExercise = {
      type: 'word_order',
      instruction: 'i',
      sentence: 'I usually walk to work.',
      alternatives: ['Usually I walk to work.'],
      translation: 't',
      explanation: 'x',
      tokens: ['walk', 'I', 'to', 'usually', 'work']
    }
    expect(gradeAuto(e, { type: 'word_order', tokens: ['I', 'usually', 'walk', 'to', 'work'] })).toMatchObject({ feedback: { correct: true } })
    expect(gradeAuto(e, { type: 'word_order', tokens: ['Usually', 'I', 'walk', 'to', 'work'] })).toMatchObject({ feedback: { correct: true } })
    expect(gradeAuto(e, { type: 'word_order', tokens: ['I', 'walk', 'usually', 'to', 'work'] })).toMatchObject({ feedback: { correct: false } })
  })

  it('traducción: si coincide se corrige sola, si no va a Claude', () => {
    const e: StoredExercise = { type: 'translation', instruction: 'i', spanish: 'Soy docente.', answers: ["I'm a teacher."], explanation: 'x' }
    expect(gradeAuto(e, { type: 'translation', text: 'I am a teacher' })).toMatchObject({ kind: 'graded', feedback: { correct: true } })
    expect(gradeAuto(e, { type: 'translation', text: 'I work as a teacher' })).toEqual({ kind: 'needs-ai' })
    expect(gradeAuto(e, { type: 'translation', text: '  ' })).toMatchObject({ kind: 'graded', feedback: { correct: false } })
  })

  it('lectura da puntaje parcial y resultado por pregunta', () => {
    const q = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'x' }
    const e: StoredExercise = { type: 'reading', instruction: 'i', text: 't', questions: [q, q] }
    expect(gradeAuto(e, { type: 'reading', choices: [1, 0] })).toMatchObject({
      feedback: { correct: false, score: 5, questionResults: [true, false], correctAnswer: '1. b\n2. b' }
    })
  })

  it('escritura va a Claude salvo que esté vacía', () => {
    const e: StoredExercise = { type: 'writing', instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
    expect(gradeAuto(e, { type: 'writing', text: 'Hello, my name is Ana.' })).toEqual({ kind: 'needs-ai' })
    expect(gradeAuto(e, { type: 'writing', text: '' })).toMatchObject({ kind: 'graded', feedback: { score: 0 } })
  })

  it('rechaza una respuesta de otro tipo', () => {
    const e: StoredExercise = { type: 'translation', instruction: 'i', spanish: 's', answers: ['a'], explanation: 'x' }
    expect(() => gradeAuto(e, { type: 'fill_blank', text: 'a' })).toThrow()
  })
})
