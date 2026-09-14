// Cálculo puro del estado de una semana a partir de sus prácticas y la fecha de hoy.

import { addDays, daysBetween, formatDayMonth, isoWeekday, mondayOf, WEEKDAY_NAMES } from '../../shared/dates'
import type { DayStatus, ExamStatus, UnitKind, WeekDayView, WeekKind } from '../../shared/progress'
import { EXAM_OPENS_ON_DAY, MAX_FALTAS, PRACTICE_DAYS } from './rules'

export interface UnitRecord {
  id: number
  index: number
  kind: UnitKind
  topicId: string
  subtopicId: string
  completedOn: string | null
}

export interface WeekRecord {
  id: number
  topicId: string
  weekStart: string
  // Primer día que cuenta para faltas (puede ser posterior al lunes).
  startsOn: string
  kind: WeekKind
  status: 'active' | 'passed' | 'failed' | 'incomplete'
  recoveredOn: string | null
  units: UnitRecord[]
}

export interface WeekComputation {
  offset: number
  days: WeekDayView[]
  faltas: number
  recovered: boolean
  effectiveFaltas: number
  completedUnits: number
  nextUnit: UnitRecord | null
  canPracticeNow: boolean
  practiceBlockedReason: string | null
  canRecover: boolean
  examStatus: ExamStatus
}

// Lunes o martes: el tópico arranca esa misma semana sin contar los días anteriores.
// Desde el miércoles: arranca el lunes siguiente.
export function firstWeekFor(today: string): { weekStart: string; startsOn: string } {
  if (isoWeekday(today) <= 2) return { weekStart: mondayOf(today), startsOn: today }
  const weekStart = addDays(mondayOf(today), 7)
  return { weekStart, startsOn: weekStart }
}

export function computeWeek(week: WeekRecord, today: string): WeekComputation {
  const offset = daysBetween(week.weekStart, today)
  const practicedDates = new Set(week.units.flatMap((u) => (u.completedOn ? [u.completedOn] : [])))
  const missed: number[] = []

  const days: WeekDayView[] = WEEKDAY_NAMES.map((_, i) => {
    const date = addDays(week.weekStart, i)
    const practiced = practicedDates.has(date)
    let status: DayStatus
    if (i >= PRACTICE_DAYS) status = 'weekend'
    else if (date < week.startsOn) status = 'skipped'
    else if (practiced) status = 'done'
    else if (date > today) status = 'upcoming'
    else if (date === today) status = 'today'
    else {
      status = 'missed'
      missed.push(i)
    }
    return { date, weekday: i + 1, status, practiced }
  })

  const faltas = missed.length
  const recovered = week.recoveredOn !== null && faltas > 0
  if (recovered) days[missed[0]].status = 'recovered'
  const effectiveFaltas = faltas - (recovered ? 1 : 0)

  const units = [...week.units].sort((a, b) => a.index - b.index)
  const completedUnits = units.filter((u) => u.completedOn).length
  const nextUnit = units.find((u) => !u.completedOn) ?? null
  const active = week.status === 'active'
  // Se puede ponerse al día con prácticas atrasadas, pero no adelantarse: la práctica N se habilita el día N.
  const allowedIndex = offset < 0 ? 0 : Math.min(offset + 1, PRACTICE_DAYS)

  let practiceBlockedReason: string | null = null
  if (!active || offset > 6) practiceBlockedReason = 'La semana ya terminó.'
  else if (offset < 0) practiceBlockedReason = `La semana empieza el ${WEEKDAY_NAMES[isoWeekday(week.startsOn) - 1]} ${formatDayMonth(week.startsOn)}.`
  else if (!nextUnit) practiceBlockedReason = 'Ya completaste todas las prácticas de la semana.'
  else if (nextUnit.index > allowedIndex) practiceBlockedReason = `La práctica ${nextUnit.index} se habilita el ${WEEKDAY_NAMES[nextUnit.index - 1]}.`

  let examStatus: ExamStatus
  if (!active || offset > 6) examStatus = 'closed'
  else if (effectiveFaltas >= MAX_FALTAS) examStatus = 'locked'
  else if (completedUnits < units.length) examStatus = 'not-ready'
  else if (offset < EXAM_OPENS_ON_DAY) examStatus = 'too-early'
  else examStatus = 'available'

  return {
    offset,
    days,
    faltas,
    recovered,
    effectiveFaltas,
    completedUnits,
    nextUnit,
    canPracticeNow: practiceBlockedReason === null,
    practiceBlockedReason,
    canRecover: active && offset === 6 && faltas > 0 && week.recoveredOn === null,
    examStatus
  }
}

export function describeExam(c: WeekComputation, week: WeekRecord): string {
  switch (c.examStatus) {
    case 'available':
      return 'El examen está disponible. Se aprueba con 8.'
    case 'not-ready': {
      const left = week.units.length - c.completedUnits
      return left === 1 ? 'Te falta 1 práctica para habilitar el examen.' : `Te faltan ${left} prácticas para habilitar el examen.`
    }
    case 'too-early':
      return `El examen se habilita el viernes ${formatDayMonth(addDays(week.weekStart, EXAM_OPENS_ON_DAY))}.`
    case 'locked':
      return c.faltas === MAX_FALTAS && week.recoveredOn === null
        ? `Examen bloqueado por ${c.effectiveFaltas} faltas. Si el domingo recuperás una, se vuelve a habilitar.`
        : `Examen bloqueado por ${c.effectiveFaltas} faltas. La semana que viene seguís con este tópico.`
    case 'closed':
      return 'La semana terminó.'
  }
}
