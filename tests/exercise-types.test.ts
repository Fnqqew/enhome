// Cada tipo de ejercicio del registro cumple lo mismo: se prepara, no muestra las respuestas, corrige,
// da pistas y se le describe a Claude. Un tipo nuevo queda probado al anotarlo en el registro.

import { describe, expect, it } from 'vitest'
import { EXERCISE_KINDS, emptyAnswer, formatGuide, gradeAuto, prepareExercise, reviewChecks, toPublicExercise } from '../src/shared/exercise-types'
import { EXERCISE_TYPES, generatedExerciseSchema, LONG_TYPES, type ExerciseType, type StoredExercise } from '../src/shared/exercises'
import { generatedSample, rightAnswer } from './helpers/exercises'

// Campos que nunca puede ver el alumno antes de responder.
const SECRET_KEYS = ['answers', 'correctIndex', 'sample', 'sampleAnswer', 'explanation', 'alternatives', 'sentence']
const OPEN: ExerciseType[] = ['translation', 'translation_set', 'dialogue', 'roleplay', 'writing']

const secretPaths = (value: unknown, path = ''): string[] => {
  if (Array.isArray(value)) return value.flatMap((v, i) => secretPaths(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => [
      ...(SECRET_KEYS.includes(key) ? [`${path}.${key}`] : []),
      ...secretPaths(v, `${path}.${key}`)
    ])
  }
  return []
}

describe('registro de tipos de ejercicio', () => {
  it('tiene un módulo para cada tipo, con el mismo nombre', () => {
    expect(Object.keys(EXERCISE_KINDS).sort()).toEqual([...EXERCISE_TYPES].sort())
    for (const type of EXERCISE_TYPES) expect(EXERCISE_KINDS[type].type).toBe(type)
  })

  it('los largos son los que se responden en partes', () => {
    expect(EXERCISE_TYPES.filter((t) => EXERCISE_KINDS[t].long).sort()).toEqual([...LONG_TYPES].sort())
  })

  it('la guía para Claude y los controles del revisor nombran cada formato', () => {
    const guide = formatGuide({ language: 'inglés', spanish: 'español rioplatense' })
    const checks = reviewChecks()
    for (const type of EXERCISE_TYPES) {
      expect(guide).toContain(`- ${type}:`)
      expect(checks).toContain(`- ${type}:`)
    }
  })
})

describe.each(EXERCISE_TYPES)('%s', (type) => {
  const prepare = (): StoredExercise => prepareExercise(generatedExerciseSchema.parse(generatedSample(type, 1)), () => 0.42)

  it('se prepara a partir de lo que genera Claude', () => {
    expect(prepare().type).toBe(type)
  })

  it('lo que ve el alumno no trae las respuestas', () => {
    const view = toPublicExercise(prepare())
    // La oración a corregir y la de completar sí se muestran: es el enunciado.
    const allowed = type === 'error_correction' || type === 'fill_blank' ? ['.sentence'] : []
    expect(secretPaths(view).filter((p) => !allowed.includes(p))).toEqual([])
  })

  it('sin responder queda mal, sin preguntarle a Claude', () => {
    const stored = prepare()
    const result = gradeAuto(stored, emptyAnswer(stored))
    expect(result.kind).toBe('graded')
    if (result.kind === 'graded') expect(result.feedback.correct).toBe(false)
  })

  it('la respuesta correcta se acepta (o la corrige Claude si es abierta)', () => {
    const stored = prepare()
    const result = gradeAuto(stored, rightAnswer(stored))
    if (result.kind === 'graded') expect(result.feedback.correct).toBe(true)
    else expect(OPEN).toContain(type)
  })

  it('tiene pista, guía y, si es abierto, el pedido de corrección', () => {
    const kind = EXERCISE_KINDS[type]
    expect(kind.hint(prepare() as never).length).toBeGreaterThan(5)
    expect(kind.check.startsWith(`${type}:`)).toBe(true)
    expect(Boolean(kind.review)).toBe(OPEN.includes(type))
  })
})
