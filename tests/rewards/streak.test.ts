import { describe, expect, it } from 'vitest'
import { computeStreak, perfectWeeks } from '../../src/main/rewards/streak'
import { addDays } from '../../src/shared/dates'
import { levelForXp, levelTitle, streakMultiplier, xpForLevel } from '../../src/main/rewards/rules'

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)
const week = (id: number, offset: number, startsOffset = offset) => ({ id, weekStart: day(offset), startsOn: day(startsOffset) })
const practiced = (...offsets: number[]): Set<string> => new Set(offsets.map(day))
const none = new Map<string, 'protected' | 'broken'>()

describe('computeStreak', () => {
  it('cuenta días hábiles seguidos; el fin de semana y el día de hoy no cortan', () => {
    const result = computeStreak({ weeks: [week(1, 0), week(2, 7)], practiced: practiced(0, 1, 2, 3, 4, 7), events: none, today: day(8) })
    expect(result).toMatchObject({ current: 6, best: 6, pendingMiss: null })
  })

  it('informa el primer día faltado sin resolver', () => {
    const result = computeStreak({ weeks: [week(1, 0)], practiced: practiced(0, 1, 3), events: none, today: day(4) })
    expect(result).toMatchObject({ current: 2, pendingMiss: day(2) })
  })

  it('un día protegido no corta y uno roto sí', () => {
    const input = { weeks: [week(1, 0)], practiced: practiced(0, 1, 3, 4), today: day(4) }
    expect(computeStreak({ ...input, events: new Map([[day(2), 'protected' as const]]) })).toMatchObject({ current: 4, pendingMiss: null })
    expect(computeStreak({ ...input, events: new Map([[day(2), 'broken' as const]]) })).toMatchObject({ current: 2, best: 2 })
  })

  it('los días anteriores al inicio de la semana no cuentan', () => {
    expect(computeStreak({ weeks: [week(1, 0, 2)], practiced: practiced(2, 3), events: none, today: day(3) })).toMatchObject({ current: 2 })
  })

  it('registra los hitos de cada racha', () => {
    const result = computeStreak({ weeks: [week(1, 0)], practiced: practiced(0, 1, 2), events: none, today: day(2) })
    expect(result.milestones).toEqual([1, 2, 3].map((length) => ({ chainStart: day(0), length })))
  })
})

describe('perfectWeeks', () => {
  it('semana completa desde el lunes con las 5 prácticas', () => {
    expect(perfectWeeks([week(1, 0)], practiced(0, 1, 2, 3, 4), day(4))).toEqual([1])
    expect(perfectWeeks([week(1, 0)], practiced(0, 1, 2, 4), day(6))).toEqual([])
    expect(perfectWeeks([week(1, 0, 1)], practiced(0, 1, 2, 3, 4), day(6))).toEqual([])
    expect(perfectWeeks([week(1, 0)], practiced(0, 1, 2, 3), day(3))).toEqual([])
  })
})

describe('reglas', () => {
  it('niveles con umbrales crecientes', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600])
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(300)).toBe(3)
    expect(levelTitle(1)).toBe('Recién llegado')
    expect(levelTitle(99)).toBe('Leyenda')
  })

  it('la racha multiplica la experiencia hasta +50 %', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(3)).toBe(1.15)
    expect(streakMultiplier(40)).toBe(1.5)
  })
})
