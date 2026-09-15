import { describe, expect, it } from 'vitest'
import type { ExerciseType } from '../../src/shared/exercises'
import { composeSession, MIN_POOL_SIZE, planPool, SESSION_SIZE, type PoolItem } from '../../src/main/practice/composition'

const total = (plan: Partial<Record<ExerciseType, number>>): number => Object.values(plan).reduce((s, n) => s + (n ?? 0), 0)

describe('planPool', () => {
  it('día de gramática: solo ejercicios de gramática y una traducción', () => {
    expect(planPool(['grammar'])).toEqual({ multiple_choice: 2, fill_blank: 2, word_order: 2, error_correction: 2, translation: 1 })
  })

  it('suma lectura y escritura cuando el subtema las trabaja', () => {
    const plan = planPool(['reading', 'writing'])
    expect(plan.reading).toBe(2)
    expect(plan.writing).toBe(2)
    expect(plan.translation).toBe(2)
    expect(plan.multiple_choice).toBe(1)
  })

  it('pide más de lo que gusta y menos de lo que no', () => {
    const plan = planPool(['grammar'], { word_order: 5, error_correction: 1 })
    expect(plan.word_order).toBe(3)
    expect(plan.error_correction).toBe(1)
  })

  it('no reduce lo obligatorio aunque no guste', () => {
    expect(planPool(['reading'], { reading: 1 }).reading).toBe(2)
  })

  it('siempre alcanza para la sesión y alternativas', () => {
    const disliked = { multiple_choice: 1, fill_blank: 1, word_order: 1, error_correction: 1, translation: 1 }
    expect(total(planPool(['grammar'], disliked))).toBeGreaterThanOrEqual(MIN_POOL_SIZE)
  })
})

function pool(plan: Partial<Record<ExerciseType, number>>): PoolItem[] {
  let id = 1
  return Object.entries(plan).flatMap(([type, count]) => Array.from({ length: count ?? 0 }, () => ({ id: id++, type: type as ExerciseType })))
}

const typesOf = (items: PoolItem[], ids: number[]): ExerciseType[] => ids.map((id) => items.find((i) => i.id === id)!.type)

describe('composeSession', () => {
  it('arma sesiones del tamaño pedido con variedad de tipos', () => {
    const items = pool(planPool(['grammar']))
    const types = typesOf(items, composeSession(items, ['grammar'], {}, () => 0))
    expect(types).toHaveLength(SESSION_SIZE)
    expect(new Set(types).size).toBe(5)
  })

  it('incluye lectura y escritura cuando corresponde, con la escritura al final', () => {
    const items = pool(planPool(['reading', 'writing']))
    const types = typesOf(items, composeSession(items, ['reading', 'writing'], {}, () => 0))
    expect(types).toContain('reading')
    expect(types[types.length - 1]).toBe('writing')
  })

  it('usa el lugar extra para el tipo mejor calificado', () => {
    const items = pool(planPool(['grammar']))
    const types = typesOf(items, composeSession(items, ['grammar'], { word_order: 5 }, () => 0))
    expect(types.filter((t) => t === 'word_order')).toHaveLength(2)
  })

  it('ordena de lo más guiado a lo más abierto', () => {
    const items = pool(planPool(['grammar', 'reading']))
    const types = typesOf(items, composeSession(items, ['grammar', 'reading'], {}, () => 0))
    expect(types.indexOf('multiple_choice')).toBeLessThan(types.indexOf('translation'))
    expect(types.indexOf('translation')).toBeLessThan(types.indexOf('reading'))
  })
})
