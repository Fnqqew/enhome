import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Placement } from '../../src/main/engine/placement'
import { Progression } from '../../src/main/engine/progression'
import { Rewards } from '../../src/main/rewards/rewards'
import { addDays } from '../../src/shared/dates'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)

let db: Db
let progression: Progression

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  progression.applyPlacementResult(curriculum[0].id, [], day(-1))
})

const completeToday = (today: string): void => {
  const unit = progression.getState(today).week!.nextUnit!
  progression.completeUnit(unit.id, today)
}

describe('pausa del curso', () => {
  it('los días en pausa no son faltas y la práctica se bloquea', () => {
    completeToday(day(0))
    progression.pause(day(1))
    const state = progression.getState(day(3))
    expect(state.pausedSince).toBe(day(1))
    expect(state.week!.faltas).toBe(0)
    expect(state.week!.days.slice(1, 4).map((d) => d.status)).toEqual(['paused', 'paused', 'paused'])
    expect(state.week!.canPracticeNow).toBe(false)
    expect(state.week!.examStatus).toBe('paused')
  })

  it('al reanudar se sigue sin faltas por los días pausados', () => {
    completeToday(day(0))
    progression.pause(day(1))
    progression.resume(day(3))
    const state = progression.getState(day(3))
    expect(state.pausedSince).toBeNull()
    expect(state.week!.faltas).toBe(0)
    expect(state.week!.canPracticeNow).toBe(true)
  })

  it('una pausa de semanas sigue sin faltas en las semanas nuevas', () => {
    progression.pause(day(1))
    const state = progression.getState(day(17))
    expect(state.week!.faltas).toBe(0)
    expect(state.week!.canPracticeNow).toBe(false)
  })

  it('pausar y reanudar el mismo día no deja rastro', () => {
    progression.pause(day(1))
    progression.resume(day(1))
    expect(db.prepare('SELECT COUNT(*) AS n FROM course_pauses').get()).toEqual({ n: 0 })
  })

  it('no se puede pausar dos veces ni reanudar sin pausa', () => {
    expect(() => progression.resume(day(1))).toThrow(/no está en pausa/)
    progression.pause(day(1))
    expect(() => progression.pause(day(2))).toThrow(/ya está en pausa/)
  })

  it('los días en pausa no cortan la racha', () => {
    const rewards = new Rewards(db, curriculum, { levels: [] }, progression)
    completeToday(day(0))
    progression.pause(day(1))
    progression.resume(day(4))
    completeToday(day(4))
    rewards.sync(day(4))
    expect(rewards.getView(day(4)).player.streak).toBe(2)
  })
})

describe('empezar desde cero', () => {
  it('arranca en el primer tópico sin examen', () => {
    const fresh = openDatabase(':memory:')
    const course = new Progression(fresh, curriculum)
    const placement = new Placement(fresh, curriculum, course, async () => [])
    placement.startFromScratch(day(0))
    const state = course.getState(day(0))
    expect(state.placementDone).toBe(true)
    expect(state.week!.topicId).toBe(curriculum[0].id)
  })

  it('anula un examen inicial empezado', () => {
    const fresh = openDatabase(':memory:')
    const course = new Progression(fresh, curriculum)
    const placement = new Placement(fresh, curriculum, course, async () => [])
    placement.start()
    placement.startFromScratch(day(0))
    expect(fresh.prepare("SELECT status FROM exams WHERE kind = 'placement'").get()).toEqual({ status: 'voided' })
  })
})
