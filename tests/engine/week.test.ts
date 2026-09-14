import { describe, expect, it } from 'vitest'
import { addDays, isoWeekday, mondayOf } from '../../src/shared/dates'
import { computeWeek, describeExam, firstWeekFor, type WeekRecord } from '../../src/main/engine/week'

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)

function makeWeek(completedOn: (string | null)[] = [], overrides: Partial<WeekRecord> = {}): WeekRecord {
  return {
    id: 1,
    topicId: 'a1-to-be',
    weekStart: MON,
    startsOn: MON,
    kind: 'normal',
    status: 'active',
    recoveredOn: null,
    units: [1, 2, 3, 4, 5].map((index) => ({
      id: index,
      index,
      kind: 'lesson' as const,
      topicId: 'a1-to-be',
      subtopicId: `sub-${index}`,
      completedOn: completedOn[index - 1] ?? null
    })),
    ...overrides
  }
}

describe('fechas', () => {
  it('calcula días de la semana y lunes', () => {
    expect(isoWeekday(MON)).toBe(1)
    expect(isoWeekday(day(6))).toBe(7)
    expect(mondayOf(day(6))).toBe(MON)
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })
})

describe('firstWeekFor', () => {
  it('lunes o martes: arranca esa semana desde hoy', () => {
    expect(firstWeekFor(day(1))).toEqual({ weekStart: MON, startsOn: day(1) })
  })

  it('de miércoles en adelante: arranca el lunes siguiente', () => {
    expect(firstWeekFor(day(2))).toEqual({ weekStart: day(7), startsOn: day(7) })
    expect(firstWeekFor(day(6))).toEqual({ weekStart: day(7), startsOn: day(7) })
  })
})

describe('computeWeek', () => {
  it('el lunes sin practicar: se puede hacer la práctica 1 y nada más', () => {
    const c = computeWeek(makeWeek(), MON)
    expect(c.days[0].status).toBe('today')
    expect(c.days[1].status).toBe('upcoming')
    expect(c.faltas).toBe(0)
    expect(c.canPracticeNow).toBe(true)
    expect(c.nextUnit?.index).toBe(1)
  })

  it('no permite adelantarse: la práctica 2 se habilita el martes', () => {
    const c = computeWeek(makeWeek([MON]), MON)
    expect(c.canPracticeNow).toBe(false)
    expect(c.practiceBlockedReason).toMatch(/martes/)
  })

  it('cuenta faltas y permite ponerse al día', () => {
    const c = computeWeek(makeWeek(), day(2))
    expect(c.days.slice(0, 2).map((d) => d.status)).toEqual(['missed', 'missed'])
    expect(c.faltas).toBe(2)
    expect(c.canPracticeNow).toBe(true)
    expect(c.examStatus).toBe('not-ready')
  })

  it('bloquea el examen con 3 faltas aunque la práctica esté completa', () => {
    const c = computeWeek(makeWeek([day(3), day(3), day(3), day(3), day(4)]), day(4))
    expect(c.faltas).toBe(3)
    expect(c.examStatus).toBe('locked')
  })

  it('el domingo se recupera una falta y el examen vuelve a habilitarse', () => {
    const week = makeWeek([day(3), day(3), day(3), day(3), day(4)])
    expect(computeWeek(week, day(6)).canRecover).toBe(true)

    const recovered = computeWeek({ ...week, recoveredOn: day(6) }, day(6))
    expect(recovered.effectiveFaltas).toBe(2)
    expect(recovered.days[0].status).toBe('recovered')
    expect(recovered.canRecover).toBe(false)
    expect(recovered.examStatus).toBe('available')
  })

  it('con 4 faltas recuperar una no alcanza', () => {
    const week = makeWeek([day(4), day(4), day(4), day(4), day(4)], { recoveredOn: day(6) })
    const c = computeWeek(week, day(6))
    expect(c.effectiveFaltas).toBe(3)
    expect(c.examStatus).toBe('locked')
    expect(describeExam(c, week)).toMatch(/semana que viene/)
  })

  it('habilita el examen el viernes con las 5 prácticas', () => {
    const c = computeWeek(makeWeek([day(0), day(1), day(2), day(3), day(4)]), day(4))
    expect(c.examStatus).toBe('available')
  })

  it('no habilita el examen antes del viernes', () => {
    // Semana que arrancó el jueves (lunes a miércoles no cuentan) y se completó toda ese día.
    const c = computeWeek(makeWeek([day(3), day(3), day(3), day(3), day(3)], { startsOn: day(3) }), day(3))
    expect(c.examStatus).toBe('too-early')
  })

  it('los días anteriores al inicio no cuentan como faltas', () => {
    const c = computeWeek(makeWeek([], { startsOn: day(1) }), day(1))
    expect(c.days[0].status).toBe('skipped')
    expect(c.faltas).toBe(0)
    expect(c.canPracticeNow).toBe(true)
  })

  it('una semana futura no deja practicar', () => {
    const c = computeWeek(makeWeek(), addDays(MON, -2))
    expect(c.canPracticeNow).toBe(false)
    expect(c.practiceBlockedReason).toMatch(/empieza/)
  })

  it('después del domingo la semana queda cerrada', () => {
    const c = computeWeek(makeWeek(), day(7))
    expect(c.examStatus).toBe('closed')
    expect(c.canPracticeNow).toBe(false)
  })
})
