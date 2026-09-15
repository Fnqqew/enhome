import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchDayChange } from '../src/main/day-watcher'
import { msUntilMidnight, toLocalDate } from '../src/shared/dates'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('msUntilMidnight', () => {
  it('calcula lo que falta para las 00:00 locales', () => {
    expect(msUntilMidnight(new Date(2026, 8, 14, 23, 59, 30))).toBe(30_000)
    expect(msUntilMidnight(new Date(2026, 8, 14, 0, 0, 0))).toBe(24 * 60 * 60 * 1000)
  })

  it('funciona en el último día del mes', () => {
    expect(msUntilMidnight(new Date(2026, 8, 30, 23, 0, 0))).toBe(60 * 60 * 1000)
  })
})

describe('watchDayChange', () => {
  it('avisa apenas pasa la medianoche', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 23, 59, 59))
    const onChange = vi.fn()
    const watcher = watchDayChange(() => toLocalDate(new Date()), onChange)

    vi.advanceTimersByTime(900)
    expect(onChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2026-09-15')
    watcher.stop()
  })

  it('avisa una sola vez por cambio de día y vuelve a avisar la medianoche siguiente', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 23, 59, 0))
    const onChange = vi.fn()
    const watcher = watchDayChange(() => toLocalDate(new Date()), onChange)

    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(onChange).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('2026-09-16')
    watcher.stop()
  })

  it('detecta un cambio de fecha fuera de la medianoche (suspensión o cambio de hora)', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 10, 0, 0))
    let today = '2026-09-14'
    const onChange = vi.fn()
    const watcher = watchDayChange(() => today, onChange)

    today = '2026-09-17'
    watcher.check()
    expect(onChange).toHaveBeenCalledWith('2026-09-17')
    watcher.stop()
  })

  it('deja de avisar después de stop', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 23, 59, 59))
    const onChange = vi.fn()
    watchDayChange(() => toLocalDate(new Date()), onChange).stop()
    vi.advanceTimersByTime(60_000)
    expect(onChange).not.toHaveBeenCalled()
  })
})
