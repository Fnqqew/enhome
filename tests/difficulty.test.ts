import { describe, expect, it } from 'vitest'
import { difficultyFrom } from '../src/shared/difficulty'

describe('escalones de dificultad', () => {
  it('se arranca guiado', () => {
    expect(difficultyFrom([])).toEqual({ difficulty: 'guided', streak: 0 })
  })

  it('sube un escalón con dos prácticas seguidas de 80 % o más', () => {
    expect(difficultyFrom([0.9]).difficulty).toBe('guided')
    expect(difficultyFrom([0.9, 0.85]).difficulty).toBe('normal')
    expect(difficultyFrom([0.9, 0.85, 1, 0.8]).difficulty).toBe('harder')
  })

  it('una práctica intermedia corta la racha, y una mala baja un escalón', () => {
    expect(difficultyFrom([0.9, 0.7, 0.9])).toEqual({ difficulty: 'guided', streak: 1 })
    expect(difficultyFrom([0.9, 0.9, 0.4]).difficulty).toBe('guided')
  })
})
