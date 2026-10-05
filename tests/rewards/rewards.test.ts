import { longSample } from '../helpers/long-exercises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum, loadRoadmap } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { simulatedExam } from '../../src/main/engine/dev'
import { Progression } from '../../src/main/engine/progression'
import { Exams } from '../../src/main/exams/exams'
import type { ExamGenerator } from '../../src/main/exams/generation'
import type { PoolGenerator } from '../../src/main/practice/generation'
import { Practice } from '../../src/main/practice/practice'
import { quantity } from '../../src/main/rewards/inventory'
import { Rewards } from '../../src/main/rewards/rewards'
import { addDays } from '../../src/shared/dates'
import type { ExamQuestion } from '../../src/shared/exams'
import type { ExerciseType, StoredExercise } from '../../src/shared/exercises'

const CONTENT = join(__dirname, '..', '..', 'content')
const curriculum = loadCurriculum(CONTENT)
const roadmap = loadRoadmap(CONTENT)

// 14/9/2026 es lunes.
const MON = '2026-09-14'
const day = (offset: number): string => addDays(MON, offset)

let db: Db
let progression: Progression
let rewards: Rewards

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  rewards = new Rewards(db, curriculum, roadmap, progression)
  progression.applyPlacementResult('a1-to-be', [], day(-1))
})

function practice(...offsets: number[]): void {
  for (const offset of offsets) progression.completeUnit(progression.getState(day(offset)).week!.nextUnit!.id, day(offset))
}

const give = (item: string, amount: number): void => {
  db.prepare('INSERT INTO inventory (item, quantity) VALUES (?, ?) ON CONFLICT (item) DO UPDATE SET quantity = excluded.quantity').run(item, amount)
}

const unlocked = (view: ReturnType<Rewards['getView']>): string[] => view.achievements.filter((a) => a.unlockedAt).map((a) => a.id)

describe('racha, experiencia y logros', () => {
  it('tres días seguidos: racha, pista, logros y nivel 2', () => {
    practice(0, 1, 2)
    const view = rewards.getView(day(2))

    expect(view.player).toMatchObject({ streak: 3, bestStreak: 3, multiplier: 1.15 })
    expect(unlocked(view)).toEqual(expect.arrayContaining(['primer-paso', 'primera-practica', 'racha-3']))
    // 3 prácticas × 20 × 1,15 + 3 logros × 30.
    expect(view.player.xp).toBe(3 * 23 + 3 * 30)
    expect(view.player.level).toBe(2)
    expect(view.inventory.find((i) => i.id === 'hint')?.quantity).toBe(1)

    const news = rewards.takeNews(day(2)).map((n) => n.kind)
    expect(news).toEqual(expect.arrayContaining(['achievement', 'power-up', 'level']))
    expect(rewards.takeNews(day(2))).toEqual([])
  })

  it('es idempotente: recalcular no vuelve a dar experiencia ni comodines', () => {
    practice(0, 1, 2)
    const first = rewards.getView(day(2))
    const second = rewards.getView(day(2))
    expect(second.player.xp).toBe(first.player.xp)
    expect(quantity(db, 'hint')).toBe(1)
  })

  it('un día hábil sin práctica corta la racha', () => {
    practice(0, 1, 3)
    const view = rewards.getView(day(3))
    expect(view.player).toMatchObject({ streak: 1, bestStreak: 2 })
    expect(view.calendar.find((d) => d.date === day(2))?.status).toBe('missed')
  })

  it('el protector de racha se usa solo', () => {
    give('streak-shield', 1)
    practice(0, 1, 3)
    const view = rewards.getView(day(3))
    expect(view.player.streak).toBe(3)
    expect(quantity(db, 'streak-shield')).toBe(0)
    expect(view.calendar.find((d) => d.date === day(2))?.status).toBe('protected')
    expect(rewards.takeNews(day(3)).some((n) => n.message.includes('protector'))).toBe(true)
  })

  it('el fin de semana y el día de hoy sin practicar todavía no cortan', () => {
    practice(0, 1, 2, 3, 4)
    expect(rewards.getView(day(7)).player.streak).toBe(5)
  })

  it('semana perfecta: protector de racha y logro', () => {
    practice(0, 1, 2, 3, 4)
    const view = rewards.getView(day(4))
    expect(unlocked(view)).toContain('semana-perfecta')
    expect(quantity(db, 'streak-shield')).toBe(1)
    expect(quantity(db, 'second-chance')).toBe(0)
  })

  it('siete días seguidos dan una segunda oportunidad', () => {
    practice(0, 1, 2, 3, 4, 7, 8)
    rewards.getView(day(8))
    expect(quantity(db, 'second-chance')).toBe(1)
    expect(quantity(db, 'hint')).toBe(2)
  })

  it('aprobar con 10 suma experiencia con bonus y desbloquea logros', () => {
    practice(0, 1, 2, 3, 4)
    progression.submitWeeklyExam(simulatedExam(curriculum[0], 10), day(4))
    const view = rewards.getView(day(4))
    expect(unlocked(view)).toEqual(expect.arrayContaining(['examen-aprobado', 'nota-10']))
    expect(view.recentXp.some((x) => x.label === 'Examen semanal' && x.amount === Math.round((120 + 2 * 15) * 1.25))).toBe(true)
    expect(view.map.levels[0].topics[0].status).toBe('passed')
  })
})

function sample(type: ExerciseType, n: number): StoredExercise {
  switch (type) {
    case 'multiple_choice':
      return { type, instruction: 'i', prompt: `P${n}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' }
    case 'fill_blank':
      return { type, instruction: 'i', sentence: `She ___ happy ${n}.`, hint: '', answers: ['is'], explanation: 'x' }
    case 'word_order':
      return { type, instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x', tokens: ['my', 'She', 'is', 'sister'] }
    case 'error_correction':
      return { type, instruction: 'i', sentence: `She are happy ${n}.`, answers: [`She is happy ${n}.`], explanation: 'x' }
    case 'translation':
      return { type, instruction: 'i', spanish: 's', answers: ['I am a teacher.'], explanation: 'x' }
    case 'reading': {
      const q = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
      return { type, instruction: 'i', text: 't', questions: [q, q] }
    }
    case 'writing':
      return { type, instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 'Hi! I am Ana.' }
    case 'translation_set':
    case 'dialogue':
    case 'roleplay':
      return longSample(type, n)
  }
}

describe('pista en la práctica', () => {
  it('se descuenta una vez por ejercicio y hasta 2 por práctica', async () => {
    const pool: PoolGenerator = async ({ counts }) =>
      (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) => Array.from({ length: count }, (_, i) => sample(type, i)))
    const practiceService = new Practice(db, curriculum, progression, pool, async () => {
      throw new Error('no se usa')
    })
    give('hint', 3)

    const view = await practiceService.start(MON)
    if (view.status !== 'session') throw new Error('se esperaba una sesión')
    const [a, b, c] = view.session.exercises

    const hint = rewards.useHint(a.id)
    expect(hint.length).toBeGreaterThan(0)
    expect(rewards.useHint(a.id)).toBe(hint)
    expect(quantity(db, 'hint')).toBe(2)

    rewards.useHint(b.id)
    expect(() => rewards.useHint(c.id)).toThrow(/2 pistas/)

    const after = practiceService.getView(MON)
    if (after.status !== 'session') throw new Error('se esperaba una sesión')
    expect(after.session.exercises[0].hint).toBe(hint)
    expect(after.session.hintsAvailable).toBe(1)
  })

  it('sin pistas no se puede usar', async () => {
    const pool: PoolGenerator = async ({ counts }) =>
      (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, count]) => Array.from({ length: count }, (_, i) => sample(type, i)))
    const practiceService = new Practice(db, curriculum, progression, pool, async () => {
      throw new Error('no se usa')
    })
    const view = await practiceService.start(MON)
    if (view.status !== 'session') throw new Error('se esperaba una sesión')
    expect(() => rewards.useHint(view.session.exercises[0].id)).toThrow(/No tenés pistas/)
  })
})

describe('segunda oportunidad en el examen', () => {
  it('dice si la respuesta está bien, una sola vez por examen y no en preguntas abiertas', async () => {
    const generator: ExamGenerator = async (request) =>
      request.items.map((item, i) => ({ topicId: item.topic.id, subtopicId: item.subtopic.id, exercise: sample(item.type, i) }))
    const exams = new Exams(db, curriculum, progression, generator, async () => {
      throw new Error('no se usa')
    })
    practice(0, 1, 2, 3, 4)
    give('second-chance', 2)

    const session = await exams.startWeekly(day(4))
    const questions = JSON.parse((db.prepare('SELECT questions FROM exams WHERE id = ?').get(session.id) as { questions: string }).questions) as ExamQuestion[]
    const mcIndex = questions.findIndex((q) => q.exercise.type === 'multiple_choice')
    const writingIndex = questions.findIndex((q) => q.exercise.type === 'writing')

    expect(() => rewards.useSecondChance(session.id, mcIndex)).toThrow(/Primero respondé/)
    expect(() => rewards.useSecondChance(session.id, writingIndex)).toThrow(/traducción ni escritura/)

    exams.saveAnswer(session.id, mcIndex, { type: 'multiple_choice', choice: 3 })
    expect(rewards.useSecondChance(session.id, mcIndex)).toMatchObject({ index: mcIndex, correct: false })
    expect(quantity(db, 'second-chance')).toBe(1)
    expect(() => rewards.useSecondChance(session.id, mcIndex)).toThrow(/Ya usaste/)

    const resumed = await exams.resume(session.id, day(4))
    expect(resumed).toMatchObject({ state: 'active', session: { secondChance: { available: 1, used: { index: mcIndex, correct: false } } } })
  })
})
