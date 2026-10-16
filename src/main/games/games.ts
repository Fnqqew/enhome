// Juegos: arma el mazo con lo ya visto del temario y guarda las partidas (récords y experiencia).

import type { CurriculumTopic } from '../../shared/curriculum'
import { GAME_IDS, GAMES_WITH_XP_PER_DAY, gameXp, type GameDeck, type GameId, type GameRecord, type GameResult } from '../../shared/games'
import type { Db } from '../db/database'
import type { Progression } from '../engine/progression'

export class GamesError extends Error {}

const MAX_SCORE = 1000

export class Games {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression
  ) {}

  // Lo visto: los tópicos aprobados, el de la semana y los anteriores a él. Sin examen inicial, el primero.
  seenTopics(today: string): CurriculumTopic[] {
    const state = this.progression.getState(today)
    const progress = this.progression.getTopicProgress()
    const currentIndex = state.week ? this.curriculum.findIndex((t) => t.id === state.week!.topicId) : -1
    const seen = this.curriculum.filter((topic, i) => {
      const status = progress.get(topic.id)?.status
      return status === 'passed' || status === 'review' || (currentIndex >= 0 && i <= currentIndex)
    })
    return seen.length > 0 ? seen : this.curriculum.slice(0, 1)
  }

  deck(today: string): GameDeck {
    const topics = this.seenTopics(today)
    const phrases = topics.flatMap((topic) =>
      topic.subtopics.flatMap((s) => s.examples.map((e) => ({ target: e.target, es: e.es, topicTitle: topic.title })))
    )
    const mistakes = topics.flatMap((topic) => topic.subtopics.flatMap((s) => s.commonMistakes))
    const words = this.db.prepare('SELECT term, translation FROM vocab ORDER BY id DESC LIMIT 200').all() as unknown as {
      term: string
      translation: string
    }[]

    const records = Object.fromEntries(GAME_IDS.map((game) => [game, this.record(game, today)])) as Record<GameId, GameRecord>
    const playedToday = (this.db.prepare('SELECT COUNT(*) AS n FROM game_scores WHERE played_on = ?').get(today) as { n: number }).n
    return { phrases, mistakes, words, records, xpGamesLeft: Math.max(0, GAMES_WITH_XP_PER_DAY - playedToday) }
  }

  finish(game: GameId, score: number, today: string): GameResult {
    if (!GAME_IDS.includes(game)) throw new GamesError('Ese juego no existe.')
    const points = Math.max(0, Math.min(MAX_SCORE, Math.round(score)))
    const before = this.record(game, today)
    const playedToday = (this.db.prepare('SELECT COUNT(*) AS n FROM game_scores WHERE played_on = ?').get(today) as { n: number }).n
    this.db.prepare('INSERT INTO game_scores (game, score, played_on) VALUES (?, ?, ?)').run(game, points, today)
    const xp = playedToday < GAMES_WITH_XP_PER_DAY && points > 0 ? gameXp(game, points) : 0
    return { score: points, best: Math.max(before.best, points), record: points > before.best && before.plays > 0, xp }
  }

  private record(game: GameId, today: string): GameRecord {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(score), 0) AS best, COUNT(*) AS plays, COALESCE(SUM(played_on = ?), 0) AS today FROM game_scores WHERE game = ?')
      .get(today, game) as { best: number; plays: number; today: number }
    return { best: row.best, plays: row.plays, playedToday: row.today }
  }
}
