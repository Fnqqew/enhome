import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../src/main/claude/bridge'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase, type Db } from '../src/main/db/database'
import { Progression } from '../src/main/engine/progression'
import { Missions } from '../src/main/mission/missions'
import { addDays } from '../src/shared/dates'
import { MISSION_AFTER_UNITS } from '../src/shared/mission'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'), 'pt')
// La semana del primer tópico empieza el lunes 19/10.
const MON = '2026-10-19'
// El día en que ya se hicieron las prácticas que habilitan la misión.
const DAY = addDays(MON, MISSION_AFTER_UNITS - 1)

const task = {
  title: 'Un audio para tu nueva compañera',
  situation: 'Te mudás a un departamento en São Paulo con Camila.',
  task: 'Dejale un audio presentándote.',
  mode: 'speak',
  checklist: ['Tu nombre y de dónde sos', 'Cómo estás hoy'],
  rubric: [
    { criterion: 'Cumple la tarea', description: 'Se presenta y dice cómo está.' },
    { criterion: 'Ser y estar', description: 'Usa bien ser y estar.' },
    { criterion: 'Naturalidad', description: 'Suena natural.' }
  ],
  minWords: 30,
  maxWords: 80
}
const review = {
  criteria: [
    { criterion: 'Cumple la tarea', score: 3, comment: 'Se presenta.' },
    { criterion: 'Ser y estar', score: 2, comment: 'Un error con estar.' },
    { criterion: 'Naturalidad', score: 1, comment: 'Algo rígido.' }
  ],
  comments: 'Bien.',
  correctedText: 'Oi, Camila! Eu sou o Juan.',
  nextStep: 'Practicá estar.'
}

let db: Db
let progression: Progression
let prompts: string[]

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  progression.applyPlacementResult(curriculum[0].id, [], '2026-10-18')
  prompts = []
})

const missions = (): Missions =>
  new Missions(db, curriculum, progression, 'pt', (async (options: { prompt: string; label: string }) => {
    prompts.push(options.prompt)
    return options.label === 'misión' ? task : review
  }) as unknown as Ask)

// Hace la práctica de cada uno de los primeros días de la semana.
function practiceDays(count: number): void {
  for (let i = 0; i < count; i++) {
    const day = addDays(MON, i)
    progression.completeUnit(progression.getState(day).week!.nextUnit!.id, day)
  }
}

describe('la misión de la semana', () => {
  it('se habilita después de unas prácticas de la semana', async () => {
    const m = missions()
    expect(m.get(MON)?.lockedReason).toMatch(/prácticas más/)
    await expect(m.create('write', MON)).rejects.toThrow(/Se habilita/)
    practiceDays(MISSION_AFTER_UNITS)
    expect(m.get(DAY)?.lockedReason).toBeNull()
  })

  it('Claude la arma una vez por semana y la evalúa con su rúbrica', async () => {
    practiceDays(MISSION_AFTER_UNITS)
    const m = missions()
    const created = await m.create('speak', DAY)
    expect(created.mission).toMatchObject({ title: task.title, mode: 'speak' })
    await m.create('speak', DAY)
    expect(prompts).toHaveLength(1)

    const done = await m.submit('Oi Camila, eu sou o Juan e sou de Rosário.', DAY)
    // 3 + 2 + 1 de 9 posibles.
    expect(done.review).toMatchObject({ percent: 67, passed: true })
    expect(done.answer).toContain('Rosário')
    expect(prompts[1]).toContain('transcripción automática')
  })
})
