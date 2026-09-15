import { describe, expect, it } from 'vitest'
import type { GeneratedExercise } from '../../src/shared/exercises'
import { prepareExercise, tokenize, toPublicExercise } from '../../src/main/practice/exercises'

describe('prepareExercise', () => {
  it('mezcla las opciones manteniendo la correcta', () => {
    const e: GeneratedExercise = { type: 'multiple_choice', instruction: 'i', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: 'x' }
    const prepared = prepareExercise(e, () => 0)
    if (prepared.type !== 'multiple_choice') throw new Error()
    expect(prepared.options[prepared.correctIndex]).toBe('b')
  })

  it('mezcla las palabras para ordenar sin dejarlas en el orden correcto', () => {
    const e: GeneratedExercise = { type: 'word_order', instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x' }
    // Un random que no mueve nada dejaría el orden original.
    const prepared = prepareExercise(e, () => 0.999)
    if (prepared.type !== 'word_order') throw new Error()
    expect([...prepared.tokens].sort()).toEqual(tokenize(e.sentence).sort())
    expect(prepared.tokens.join(' ')).not.toBe('She is my sister')
  })

  it('rechaza un completar sin hueco o con dos', () => {
    const base = { type: 'fill_blank' as const, instruction: 'i', hint: '', answers: ['is'], explanation: 'x' }
    expect(() => prepareExercise({ ...base, sentence: 'She is happy.' })).toThrow()
    expect(() => prepareExercise({ ...base, sentence: 'She ___ happy ___.' })).toThrow()
  })

  it('rechaza opciones repetidas', () => {
    const e: GeneratedExercise = { type: 'multiple_choice', instruction: 'i', prompt: 'p', options: ['is', 'are', 'Is', 'am'], correctIndex: 0, explanation: 'x' }
    expect(() => prepareExercise(e)).toThrow(/repetidas/)
  })

  it('rechaza una oración para corregir que no tiene error', () => {
    const e: GeneratedExercise = { type: 'error_correction', instruction: 'i', sentence: 'She is happy', answers: ['She is happy.'], explanation: 'x' }
    expect(() => prepareExercise(e)).toThrow(/ningún error/)
  })

  it('rechaza una opción correcta fuera de rango', () => {
    const e: GeneratedExercise = { type: 'multiple_choice', instruction: 'i', prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 3, explanation: 'x' }
    expect(() => prepareExercise(e)).toThrow()
  })
})

describe('toPublicExercise', () => {
  it('no expone respuestas', () => {
    const reading = prepareExercise({
      type: 'reading',
      instruction: 'i',
      text: 't',
      questions: [{ prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }]
        .concat([{ prompt: 'q', options: ['a', 'b', 'c'], correctIndex: 1, explanation: 'y' }])
    })
    const json = JSON.stringify(toPublicExercise(reading))
    expect(json).not.toContain('correctIndex')
    expect(json).not.toContain('explanation')

    const translation = toPublicExercise({ type: 'translation', instruction: 'i', spanish: 's', answers: ['secret'], explanation: 'x' })
    expect(JSON.stringify(translation)).not.toContain('secret')
  })
})
