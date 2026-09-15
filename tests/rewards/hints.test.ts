import { describe, expect, it } from 'vitest'
import { buildHint } from '../../src/main/rewards/hints'

describe('buildHint', () => {
  it('opción múltiple: descarta dos incorrectas y nunca la correcta', () => {
    const hint = buildHint({ type: 'multiple_choice', instruction: 'i', prompt: 'p', options: ['is', 'are', 'am', 'be'], correctIndex: 0, explanation: 'x' })
    expect(hint).toBe('Descartá «are» y «am».')
  })

  it('completar: primera letra y largo', () => {
    expect(buildHint({ type: 'fill_blank', instruction: 'i', sentence: 'She ___ happy.', hint: '', answers: ['is'], explanation: 'x' })).toBe(
      'La respuesta empieza con «i» y tiene 2 caracteres.'
    )
  })

  it('ordenar: primeras dos palabras', () => {
    const hint = buildHint({ type: 'word_order', instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x', tokens: [] })
    expect(hint).toBe('La oración empieza con «She is».')
  })

  it('corregir: señala la palabra con el error', () => {
    const hint = buildHint({ type: 'error_correction', instruction: 'i', sentence: 'She are happy.', answers: ['She is happy.'], explanation: 'x' })
    expect(hint).toBe('Fijate en «are».')
  })

  it('traducción, lectura y escritura dan un comienzo o descartan opciones', () => {
    expect(buildHint({ type: 'translation', instruction: 'i', spanish: 's', answers: ['I am a teacher.'], explanation: 'x' })).toBe('Podés empezar así: «I am…»')
    const q = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
    expect(buildHint({ type: 'reading', instruction: 'i', text: 't', questions: [q, { ...q, correctIndex: 1 }] })).toBe(
      'Pregunta 1: descartá «b». Pregunta 2: descartá «a».'
    )
    expect(
      buildHint({ type: 'writing', instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 'Hi! My name is Ana. I live here.' })
    ).toBe('Una forma de empezar: «Hi!»')
  })
})
