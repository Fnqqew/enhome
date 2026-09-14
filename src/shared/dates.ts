// Fechas locales como texto 'YYYY-MM-DD'. Se comparan como strings y no sufren husos horarios.

export type LocalDate = string

export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const

const pad = (n: number): string => String(n).padStart(2, '0')

export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Mediodía para que un cambio de horario nunca mueva el día.
function parse(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toLocalDate(parse(value)) === value
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = parse(date)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)
}

// 1 = lunes … 7 = domingo.
export function isoWeekday(date: LocalDate): number {
  const day = parse(date).getDay()
  return day === 0 ? 7 : day
}

export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date))
}

export function weekdayName(date: LocalDate): string {
  return WEEKDAY_NAMES[isoWeekday(date) - 1]
}

// 'd/m', por ejemplo 14/9.
export function formatDayMonth(date: LocalDate): string {
  const [, m, d] = date.split('-')
  return `${Number(d)}/${Number(m)}`
}
