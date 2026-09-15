// Recompensas: se recalculan a partir de lo que el alumno hizo (prácticas, exámenes, resúmenes),
// de forma idempotente: cada experiencia, comodín y logro se otorga una sola vez.

import type { CurriculumTopic, Roadmap } from '../../shared/curriculum'
import { addDays, isoWeekday, mondayOf } from '../../shared/dates'
import type { ExamQuestion } from '../../shared/exams'
import type { ExerciseAnswer, StoredExercise } from '../../shared/exercises'
import {
  POWER_UP_IDS,
  POWER_UPS,
  secondChanceMessage,
  type CalendarDay,
  type PowerUpId,
  type ProgressView,
  type RewardNews,
  type SecondChanceResult
} from '../../shared/rewards'
import { buildCurriculumMap } from '../content/curriculum-map'
import { transaction, type Db } from '../db/database'
import type { Progression } from '../engine/progression'
import { PASS_GRADE } from '../engine/rules'
import { gradeAuto } from '../practice/grading'
import { ACHIEVEMENTS, type RewardStats } from './achievements'
import { buildHint } from './hints'
import { consume, grant, hintContext, quantity, secondChanceContext } from './inventory'
import {
  HINT_EVERY_STREAK_DAYS,
  levelForXp,
  levelTitle,
  MAX_HINTS_PER_SESSION,
  SECOND_CHANCE_EVERY_STREAK_DAYS,
  streakMultiplier,
  XP,
  xpForLevel
} from './rules'
import { computeStreak, perfectWeeks, type StreakWeek } from './streak'

export class RewardsError extends Error {}

const CALENDAR_WEEKS = 5
const RECENT_XP = 8
const OPEN_TYPES = new Set(['translation', 'writing'])

const XP_LABELS: Record<string, string> = {
  practice: 'Práctica',
  recovery: 'Recuperación',
  placement: 'Examen inicial',
  weekly: 'Examen semanal',
  mock: 'Simulacro',
  achievement: 'Logro'
}

export class Rewards {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly roadmap: Roadmap,
    private readonly progression: Progression
  ) {}

  sync(today: string): void {
    this.progression.getState(today)

    transaction(this.db, () => {
      const { weeks, practiced } = this.streakData()

      // Días faltados nuevos: se usa un protector si hay (y había racha); si no, se corta.
      let streak = computeStreak({ weeks, practiced, events: this.streakEvents(), today })
      while (streak.pendingMiss) {
        if (streak.current > 0 && quantity(this.db, 'streak-shield') > 0) {
          consume(this.db, 'streak-shield')
          this.db.prepare("INSERT INTO streak_days (date, outcome) VALUES (?, 'protected')").run(streak.pendingMiss)
          this.news('power-up', `🛡️ Usaste un protector de racha: tu racha de ${streak.current} días sigue en pie.`)
        } else {
          this.db.prepare("INSERT INTO streak_days (date, outcome) VALUES (?, 'broken')").run(streak.pendingMiss)
          if (streak.current >= 3) this.news('streak', `Se cortó tu racha de ${streak.current} días. ¡Hoy podés empezar una nueva!`)
        }
        streak = computeStreak({ weeks, practiced, events: this.streakEvents(), today })
      }

      for (const m of streak.milestones) {
        if (m.length % HINT_EVERY_STREAK_DAYS === 0) this.grantItem('hint', `hint:streak:${m.chainStart}:${m.length}`, today)
        if (m.length % SECOND_CHANCE_EVERY_STREAK_DAYS === 0) {
          this.grantItem('second-chance', `second-chance:streak:${m.chainStart}:${m.length}`, today)
        }
      }
      const perfect = perfectWeeks(weeks, practiced, today)
      for (const weekId of perfect) this.grantItem('streak-shield', `streak-shield:week:${weekId}`, today)

      this.awardActivity(streakMultiplier(streak.current), today)

      const previousLevel = this.player().player_level
      const stats = this.stats(streak.best, perfect.length, levelForXp(this.totalXp()))
      const unlocked = this.unlockedAchievements()
      for (const achievement of ACHIEVEMENTS) {
        if (unlocked.has(achievement.id) || achievement.value(stats) < achievement.target) continue
        this.db.prepare('INSERT INTO achievements (id) VALUES (?)').run(achievement.id)
        this.award(`achievement:${achievement.id}`, XP.achievement, today)
        this.news('achievement', `${achievement.icon} ¡Logro desbloqueado: ${achievement.title}!`)
      }

      const xp = this.totalXp()
      const level = levelForXp(xp)
      if (level > previousLevel) this.news('level', `⬆️ ¡Subiste al nivel ${level}: ${levelTitle(level)}!`)
      this.db.prepare('UPDATE player SET xp = ?, player_level = ?, streak = ?, best_streak = ? WHERE id = 1').run(xp, level, streak.current, streak.best)
    })
  }

  getView(today: string): ProgressView {
    this.sync(today)
    const player = this.player()
    const { weeks, practiced } = this.streakData()
    const events = this.streakEvents()
    const streak = computeStreak({ weeks, practiced, events, today })
    const level = player.player_level
    const unlocked = this.unlockedAchievements()
    const stats = this.stats(streak.best, perfectWeeks(weeks, practiced, today).length, level)

    const calendarStart = addDays(mondayOf(today), -(CALENDAR_WEEKS - 1) * 7)
    const calendar: CalendarDay[] = Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => {
      const date = addDays(calendarStart, i)
      if (date > today) return { date, status: 'future' }
      if (practiced.has(date)) return { date, status: 'done' }
      if (streak.expected.has(date)) {
        if (date === today) return { date, status: 'today' }
        return { date, status: events.get(date) === 'protected' ? 'protected' : 'missed' }
      }
      return { date, status: isoWeekday(date) >= 6 ? 'rest' : 'none' }
    })

    const correct = this.count('SELECT COUNT(*) AS n FROM exercise_attempts WHERE correct = 1')
    const grades = this.db.prepare("SELECT grade FROM exams WHERE kind = 'weekly' AND status = 'submitted'").all() as unknown as { grade: number }[]
    const state = this.progression.getState(today)
    const recent = this.db.prepare('SELECT source, amount, created_on FROM xp_events ORDER BY id DESC LIMIT ?').all(RECENT_XP) as unknown as {
      source: string
      amount: number
      created_on: string
    }[]

    return {
      player: {
        level,
        title: levelTitle(level),
        xp: player.xp,
        xpIntoLevel: player.xp - xpForLevel(level),
        xpForNextLevel: xpForLevel(level + 1) - xpForLevel(level),
        streak: streak.current,
        bestStreak: streak.best,
        multiplier: streakMultiplier(streak.current)
      },
      calendar,
      inventory: POWER_UP_IDS.map((id) => ({ id, ...POWER_UPS[id], quantity: quantity(this.db, id) })),
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id,
        icon: a.icon,
        title: a.title,
        description: a.description,
        unlockedAt: unlocked.get(a.id) ?? null,
        current: Math.min(a.value(stats), a.target),
        target: a.target
      })),
      stats: {
        practices: stats.practices,
        exercisesAnswered: stats.exercisesAnswered,
        accuracy: stats.exercisesAnswered > 0 ? Math.round((correct * 100) / stats.exercisesAnswered) : null,
        weeklyPassed: stats.weeklyPassed,
        averageGrade: grades.length > 0 ? Math.round((grades.reduce((s, g) => s + g.grade, 0) / grades.length) * 10) / 10 : null,
        mocks: stats.mocks
      },
      map: buildCurriculumMap(this.curriculum, this.roadmap, this.progression.getTopicProgress(), state.week?.topicId ?? null, state.placementDone),
      recentXp: recent.map((r) => ({ label: XP_LABELS[r.source.split(':')[0]] ?? 'Experiencia', amount: r.amount, date: r.created_on }))
    }
  }

  // Avisos nuevos (logros, niveles, comodines); se marcan como vistos al entregarlos.
  takeNews(today: string): RewardNews[] {
    this.sync(today)
    const rows = this.db.prepare('SELECT id, kind, message FROM reward_news WHERE seen = 0 ORDER BY id').all() as unknown as RewardNews[]
    if (rows.length > 0) this.db.prepare('UPDATE reward_news SET seen = 1 WHERE id <= ?').run(rows[rows.length - 1].id)
    return rows.map((r) => ({ id: r.id, kind: r.kind, message: r.message }))
  }

  useHint(exerciseId: number): string {
    return transaction(this.db, () => {
      const row = this.db
        .prepare(
          'SELECT e.payload, e.slot, e.session_id, s.completed_on FROM exercises e JOIN practice_sessions s ON s.id = e.session_id WHERE e.id = ?'
        )
        .get(exerciseId) as { payload: string; slot: number | null; session_id: number; completed_on: string | null } | undefined
      if (!row || row.slot === null) throw new RewardsError('Ese ejercicio no es parte de una práctica.')
      if (row.completed_on) throw new RewardsError('Esa práctica ya terminó.')
      if (this.db.prepare('SELECT 1 FROM exercise_attempts WHERE exercise_id = ?').get(exerciseId)) {
        throw new RewardsError('Ese ejercicio ya está respondido.')
      }

      const existing = this.db.prepare('SELECT detail FROM powerup_uses WHERE context = ?').get(hintContext(exerciseId)) as { detail: string } | undefined
      if (existing) return existing.detail

      const usedInSession = this.count(
        "SELECT COUNT(*) AS n FROM powerup_uses p JOIN exercises e ON p.context = 'hint:exercise:' || e.id WHERE e.session_id = ?",
        row.session_id
      )
      if (usedInSession >= MAX_HINTS_PER_SESSION) throw new RewardsError(`Ya usaste ${MAX_HINTS_PER_SESSION} pistas en esta práctica.`)

      consume(this.db, 'hint')
      const hint = buildHint(JSON.parse(row.payload) as StoredExercise)
      this.db.prepare("INSERT INTO powerup_uses (item, context, detail) VALUES ('hint', ?, ?)").run(hintContext(exerciseId), hint)
      return hint
    })
  }

  useSecondChance(examId: number, index: number): SecondChanceResult {
    return transaction(this.db, () => {
      const exam = this.db.prepare('SELECT kind, status, questions FROM exams WHERE id = ?').get(examId) as
        | { kind: string; status: string; questions: string }
        | undefined
      if (!exam || exam.kind !== 'weekly' || exam.status !== 'in_progress') {
        throw new RewardsError('La segunda oportunidad solo se usa durante un examen semanal.')
      }
      if (this.db.prepare('SELECT 1 FROM powerup_uses WHERE context = ?').get(secondChanceContext(examId))) {
        throw new RewardsError('Ya usaste la segunda oportunidad en este examen.')
      }
      const question = (JSON.parse(exam.questions) as ExamQuestion[])[index]
      if (!question) throw new RewardsError('Esa pregunta no existe.')
      if (OPEN_TYPES.has(question.exercise.type)) throw new RewardsError('La segunda oportunidad no se puede usar en traducción ni escritura.')
      const saved = this.db.prepare('SELECT answer FROM exam_answers WHERE exam_id = ? AND question_index = ?').get(examId, index) as
        | { answer: string | null }
        | undefined
      if (!saved?.answer) throw new RewardsError('Primero respondé la pregunta.')

      const graded = gradeAuto(question.exercise, JSON.parse(saved.answer) as ExerciseAnswer)
      const correct = graded.kind === 'graded' && graded.feedback.correct
      consume(this.db, 'second-chance')
      this.db
        .prepare("INSERT INTO powerup_uses (item, context, detail) VALUES ('second-chance', ?, ?)")
        .run(secondChanceContext(examId), JSON.stringify({ index, correct }))
      return { index, correct, message: secondChanceMessage(correct) }
    })
  }

  private awardActivity(multiplier: number, today: string): void {
    const units = this.db
      .prepare(
        `SELECT u.id, u.completed_on AS date,
           (SELECT COUNT(*) FROM exercise_attempts a JOIN exercises e ON e.id = a.exercise_id WHERE e.session_id = s.id AND a.correct = 1) AS correct
         FROM practice_units u LEFT JOIN practice_sessions s ON s.unit_id = u.id
         WHERE u.completed_on IS NOT NULL`
      )
      .all() as unknown as { id: number; date: string; correct: number | null }[]
    for (const u of units) this.award(`practice:${u.id}`, (XP.practice + (u.correct ?? 0) * XP.perCorrectExercise) * multiplier, u.date)

    const recoveries = this.db
      .prepare('SELECT id, completed_on AS date FROM practice_sessions WHERE unit_id IS NULL AND completed_on IS NOT NULL')
      .all() as unknown as { id: number; date: string }[]
    for (const r of recoveries) this.award(`recovery:${r.id}`, XP.recovery * multiplier, r.date)

    const exams = this.db
      .prepare("SELECT id, kind, grade, passed, COALESCE(started_on, substr(submitted_at, 1, 10)) AS date FROM exams WHERE status = 'submitted'")
      .all() as unknown as { id: number; kind: string; grade: number | null; passed: number | null; date: string | null }[]
    for (const e of exams) {
      const date = e.date ?? today
      if (e.kind === 'placement') this.award(`placement:${e.id}`, XP.placement, date)
      else if (e.kind === 'mock') this.award(`mock:${e.id}`, XP.mock * multiplier, date)
      else if (e.passed === 1) {
        const bonus = Math.max(0, Math.round((e.grade ?? PASS_GRADE) - PASS_GRADE)) * XP.perPointAbovePass
        this.award(`weekly:${e.id}`, (XP.examPassed + bonus) * multiplier, date)
      } else this.award(`weekly:${e.id}`, XP.examFailed * multiplier, date)
    }
  }

  private stats(bestStreak: number, perfectWeekCount: number, playerLevel: number): RewardStats {
    const progress = this.progression.getTopicProgress()
    const passed = (topicId: string): boolean => ['passed', 'review'].includes(progress.get(topicId)?.status ?? '')
    const levels = [...new Set(this.curriculum.map((t) => t.level))]
    return {
      placementDone: this.player().placement_done_at !== null,
      practices: this.count('SELECT COUNT(*) AS n FROM practice_units WHERE completed_on IS NOT NULL'),
      exercisesAnswered: this.count('SELECT COUNT(*) AS n FROM exercise_attempts'),
      ratings: this.count(
        'SELECT (SELECT COUNT(*) FROM exercise_attempts WHERE user_rating IS NOT NULL) + (SELECT COUNT(*) FROM summaries WHERE user_rating IS NOT NULL) AS n'
      ),
      bestStreak,
      perfectWeeks: perfectWeekCount,
      weeklyPassed: this.count("SELECT COUNT(*) AS n FROM exams WHERE kind = 'weekly' AND status = 'submitted' AND passed = 1"),
      perfectGrades: this.count("SELECT COUNT(*) AS n FROM exams WHERE kind = 'weekly' AND status = 'submitted' AND grade >= 10"),
      comebacks: this.count("SELECT COUNT(*) AS n FROM topic_progress WHERE status IN ('passed', 'review') AND failed_attempts > 0"),
      recoveries: this.count('SELECT COUNT(*) AS n FROM weeks WHERE recovered_on IS NOT NULL'),
      mocks: this.count("SELECT COUNT(*) AS n FROM exams WHERE kind = 'mock' AND status = 'submitted'"),
      aiSummaries: this.count("SELECT COUNT(*) AS n FROM summaries WHERE source = 'ai'"),
      levelsComplete: levels.filter((level) => this.curriculum.filter((t) => t.level === level).every((t) => passed(t.id))),
      playerLevel
    }
  }

  private streakData(): { weeks: StreakWeek[]; practiced: Set<string> } {
    const weeks = this.db.prepare('SELECT id, week_start AS weekStart, starts_on AS startsOn FROM weeks ORDER BY week_start').all() as unknown as StreakWeek[]
    const dates = this.db.prepare('SELECT DISTINCT completed_on AS date FROM practice_units WHERE completed_on IS NOT NULL').all() as unknown as {
      date: string
    }[]
    return { weeks, practiced: new Set(dates.map((d) => d.date)) }
  }

  private streakEvents(): Map<string, 'protected' | 'broken'> {
    const rows = this.db.prepare('SELECT date, outcome FROM streak_days').all() as unknown as { date: string; outcome: 'protected' | 'broken' }[]
    return new Map(rows.map((r) => [r.date, r.outcome]))
  }

  private grantItem(item: PowerUpId, source: string, today: string): void {
    if (grant(this.db, item, source, today)) this.news('power-up', `${POWER_UPS[item].icon} Ganaste un comodín: ${POWER_UPS[item].label}.`)
  }

  private award(source: string, amount: number, date: string): void {
    this.db.prepare('INSERT OR IGNORE INTO xp_events (source, amount, created_on) VALUES (?, ?, ?)').run(source, Math.round(amount), date)
  }

  private news(kind: RewardNews['kind'], message: string): void {
    this.db.prepare('INSERT INTO reward_news (kind, message) VALUES (?, ?)').run(kind, message)
  }

  private totalXp(): number {
    return this.count('SELECT COALESCE(SUM(amount), 0) AS n FROM xp_events')
  }

  private unlockedAchievements(): Map<string, string> {
    const rows = this.db.prepare('SELECT id, unlocked_at FROM achievements').all() as unknown as { id: string; unlocked_at: string }[]
    return new Map(rows.map((r) => [r.id, r.unlocked_at]))
  }

  private player(): { xp: number; player_level: number; placement_done_at: string | null } {
    return this.db.prepare('SELECT xp, player_level, placement_done_at FROM player WHERE id = 1').get() as {
      xp: number
      player_level: number
      placement_done_at: string | null
    }
  }

  private count(sql: string, ...params: (string | number)[]): number {
    return (this.db.prepare(sql).get(...params) as { n: number }).n
  }
}
