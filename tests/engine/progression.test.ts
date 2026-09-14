import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { simulatedExam } from '../../src/main/engine/dev'
import { Progression } from '../../src/main/engine/progression'
import { addDays } from '../../src/shared/dates'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = (id: string) => curriculum.find((t) => t.id === id)!

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)

let db: Db
let p: Progression

beforeEach(() => {
  db = openDatabase(':memory:')
  p = new Progression(db, curriculum)
})

// Arranca en el tópico pedido con la semana del lunes 14/9 (examen inicial el domingo anterior).
function startAt(topicId: string): void {
  p.applyPlacementResult(topicId, [], day(-1))
}

function practiceEachWeekday(from = 0, to = 4): void {
  for (let i = from; i <= to; i++) {
    const week = p.getState(day(i)).week!
    p.completeUnit(week.nextUnit!.id, day(i))
  }
}

function exam(grade: number, today: string) {
  const week = p.getState(today).week!
  const t = topic(week.topicId)
  return p.submitWeeklyExam(simulatedExam(t, grade, topic(t.prerequisites[0] ?? t.id)), today)
}

describe('examen inicial', () => {
  it('un miércoles: la semana arranca el lunes siguiente', () => {
    p.applyPlacementResult('a1-present-simple', [], day(2))
    const state = p.getState(day(2))
    expect(state.placementDone).toBe(true)
    expect(state.week?.weekStart).toBe(day(7))
    expect(state.week?.canPracticeNow).toBe(false)
    expect(state.level).toBe('A1')
  })

  it('un martes: arranca esa semana y el lunes no es falta', () => {
    p.applyPlacementResult('a1-to-be', [], day(1))
    const week = p.getState(day(1)).week!
    expect(week.weekStart).toBe(MON)
    expect(week.days[0].status).toBe('skipped')
    expect(week.canPracticeNow).toBe(true)
  })

  it('marca como aprobados los tópicos anteriores', () => {
    startAt('a1-possessives-prepositions')
    const rows = db.prepare('SELECT topic_id, status FROM topic_progress').all() as { topic_id: string; status: string }[]
    const status = Object.fromEntries(rows.map((r) => [r.topic_id, r.status]))
    expect(status['a1-to-be']).toBe('passed')
    expect(status['a1-present-simple']).toBe('passed')
    expect(status['a1-possessives-prepositions']).toBe('in_progress')
    expect(status['a2-past-simple']).toBe('locked')
  })

  it('no se puede aplicar dos veces', () => {
    startAt('a1-to-be')
    expect(() => startAt('a1-to-be')).toThrow(/ya se aplicó/)
  })
})

describe('semana completa y examen', () => {
  it('aprobar: el tópico queda aprobado y el siguiente arranca el lunes', () => {
    startAt('a1-to-be')
    practiceEachWeekday()
    expect(p.getState(day(4)).week?.examStatus).toBe('available')

    const outcome = exam(9, day(5))
    expect(outcome.passed).toBe(true)
    expect(outcome.nextWeekStart).toBe(day(7))

    const state = p.getState(day(5))
    expect(state.week?.topicId).toBe('a1-nouns-articles')
    expect(state.week?.weekStart).toBe(day(7))
  })

  it('reprobar: semana de reintento del mismo tópico con refuerzo', () => {
    startAt('a1-nouns-articles')
    practiceEachWeekday()
    const outcome = exam(6, day(5))
    expect(outcome.passed).toBe(false)

    const week = p.getState(day(7)).week!
    expect(week.topicId).toBe('a1-nouns-articles')
    expect(week.kind).toBe('retry')
    expect(week.units.every((u) => u.kind === 'focus')).toBe(true)
    expect(p.getState(day(7)).attempts).toEqual({ attempts: 1, failed: 1 })
  })

  it('reprobar dos veces: la semana siguiente arranca con repaso de prerrequisitos', () => {
    startAt('a1-nouns-articles')
    practiceEachWeekday()
    exam(6, day(5))
    practiceEachWeekday(7, 11)
    exam(6, day(12))

    const week = p.getState(day(14)).week!
    expect(week.units.slice(0, 2).map((u) => [u.kind, u.topicId])).toEqual([
      ['review', 'a1-to-be'],
      ['review', 'a1-to-be']
    ])
  })

  it('el examen no se puede rendir si no está disponible', () => {
    startAt('a1-to-be')
    practiceEachWeekday(0, 3)
    expect(() => exam(10, day(3))).toThrow(/práctica/)
  })

  it('detecta tópicos anteriores débiles y los marca para repaso', () => {
    startAt('a1-nouns-articles')
    practiceEachWeekday()
    const outcome = exam(4, day(5))
    expect(outcome.weakTopics).toEqual(['a1-to-be'])
    expect(p.getState(day(5)).reviewTopics.map((t) => t.id)).toEqual(['a1-to-be'])
  })

  it('aprobar el último tópico termina el temario', () => {
    const last = curriculum[curriculum.length - 1]
    startAt(last.id)
    practiceEachWeekday()
    expect(exam(10, day(5)).finished).toBe(true)
    expect(p.getState(day(7)).finished).toBe(true)
  })
})

describe('faltas y recuperación', () => {
  it('3 faltas bloquean el examen y recuperar el domingo lo habilita', () => {
    startAt('a1-to-be')
    // Faltó lunes, martes y miércoles; se pone al día el jueves y el viernes.
    for (let i = 0; i < 4; i++) p.completeUnit(p.getState(day(3)).week!.nextUnit!.id, day(3))
    p.completeUnit(p.getState(day(4)).week!.nextUnit!.id, day(4))
    expect(p.getState(day(4)).week?.examStatus).toBe('locked')

    p.recordRecoverySession(day(6))
    const week = p.getState(day(6)).week!
    expect(week.effectiveFaltas).toBe(2)
    expect(week.examStatus).toBe('available')
  })

  it('practicar un domingo con faltas recupera una sola vez', () => {
    startAt('a1-to-be')
    practiceEachWeekday(2, 4)
    p.completeUnit(p.getState(day(6)).week!.nextUnit!.id, day(6))
    const week = p.getState(day(6)).week!
    expect(week.recovered).toBe(true)
    expect(week.effectiveFaltas).toBe(1)
    expect(() => p.recordRecoverySession(day(6))).toThrow()
  })

  it('no se puede completar una práctica que no es la siguiente', () => {
    startAt('a1-to-be')
    const week = p.getState(MON).week!
    expect(() => p.completeUnit(week.units[1].id, MON)).toThrow(/próxima/)
  })
})

describe('cierre de semana', () => {
  it('una semana incompleta continúa el lunes con lo pendiente primero', () => {
    startAt('a1-to-be')
    practiceEachWeekday(0, 2)
    const previous = p.getState(day(2)).week!

    const week = p.getState(day(8)).week!
    expect(week.kind).toBe('carry')
    expect(week.weekStart).toBe(day(7))
    expect(week.startsOn).toBe(day(7))
    expect(week.units.slice(0, 2).map((u) => u.subtopicId)).toEqual(previous.units.slice(3).map((u) => u.subtopicId))
    expect(week.units.slice(2).every((u) => u.kind === 'review')).toBe(true)
    expect(week.days[0].status).toBe('missed')
  })

  it('después de una ausencia larga las faltas cuentan desde hoy', () => {
    startAt('a1-to-be')
    const week = p.getState(day(23)).week!
    expect(week.weekStart).toBe(day(21))
    expect(week.startsOn).toBe(day(23))
    expect(week.faltas).toBe(0)
  })
})
