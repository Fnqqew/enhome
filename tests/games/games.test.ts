import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase, type Db } from '../../src/main/db/database'
import { Progression } from '../../src/main/engine/progression'
import { Games } from '../../src/main/games/games'
import { Rewards } from '../../src/main/rewards/rewards'
import { choices, normalizeText, scoreDictation } from '../../src/renderer/src/components/games/kit'
import { GAMES_WITH_XP_PER_DAY } from '../../src/shared/games'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const TODAY = '2026-10-16'

let db: Db
let progression: Progression
let games: Games

beforeEach(() => {
  db = openDatabase(':memory:')
  progression = new Progression(db, curriculum)
  games = new Games(db, curriculum, progression)
})

describe('mazo de los juegos', () => {
  it('sin examen inicial usa el primer tópico', () => {
    const deck = games.deck(TODAY)
    const first = curriculum[0]
    expect(deck.phrases.length).toBe(first.subtopics.reduce((n, s) => n + s.examples.length, 0))
    expect(deck.mistakes.length).toBeGreaterThan(0)
  })

  it('incluye los tópicos hasta el de la semana', () => {
    progression.applyPlacementResult(curriculum[2].id, [], '2026-10-11')
    const titles = new Set(games.deck(TODAY).phrases.map((p) => p.topicTitle))
    expect([...titles]).toEqual(curriculum.slice(0, 3).map((t) => t.title))
  })
})

describe('partidas', () => {
  it('guarda el récord y da experiencia solo a las primeras del día', () => {
    const first = games.finish('contrarreloj', 12, TODAY)
    expect(first).toMatchObject({ score: 12, best: 12, record: false })
    expect(first.xp).toBeGreaterThan(0)
    const better = games.finish('contrarreloj', 20, TODAY)
    expect(better).toMatchObject({ best: 20, record: true })

    for (let i = 2; i < GAMES_WITH_XP_PER_DAY; i++) games.finish('memotest', 50, TODAY)
    expect(games.finish('memotest', 50, TODAY).xp).toBe(0)
    expect(games.deck(TODAY).xpGamesLeft).toBe(0)
    expect(games.deck(TODAY).records.contrarreloj).toMatchObject({ best: 20, plays: 2, playedToday: 2 })
  })

  it('la experiencia de los juegos llega al total del jugador', () => {
    const rewards = new Rewards(db, curriculum, { levels: [] }, progression)
    const before = rewards.getView(TODAY).player.xp
    const { xp } = games.finish('verdadero', 80, TODAY)
    rewards.takeNews(TODAY)
    expect(rewards.getView(TODAY).player.xp).toBe(before + xp)
  })
})

describe('utilidades de los juegos', () => {
  it('el dictado da media palabra por una tilde', () => {
    expect(scoreDictation('Ela e medica', 'Ela é médica.')).toMatchObject({ score: 67 })
    expect(scoreDictation('ela é médica', 'Ela é médica.').score).toBe(100)
    expect(scoreDictation('', 'Hola').score).toBe(0)
  })

  it('las opciones incluyen la correcta una sola vez', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'a']
    const { options, answer } = choices('a', pool, 4, (x) => x)
    expect(options).toHaveLength(4)
    expect(options[answer]).toBe('a')
    expect(options.filter((o) => o === 'a')).toHaveLength(1)
  })

  it('normaliza puntuación y espacios', () => {
    expect(normalizeText('  Ça va ? ')).toBe('ça va')
  })
})
