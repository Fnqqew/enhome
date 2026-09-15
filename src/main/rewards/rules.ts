// Reglas de recompensas (ver docs/documento-base.md).

export const XP = {
  practice: 20,
  perCorrectExercise: 3,
  recovery: 15,
  placement: 50,
  examPassed: 120,
  perPointAbovePass: 15,
  examFailed: 30,
  mock: 25,
  achievement: 30
} as const

// La constancia multiplica la experiencia: +5 % por día de racha, hasta +50 %.
export const STREAK_BONUS_PER_DAY = 0.05
export const MAX_STREAK_BONUS_DAYS = 10

export function streakMultiplier(streak: number): number {
  return Math.round((1 + STREAK_BONUS_PER_DAY * Math.min(streak, MAX_STREAK_BONUS_DAYS)) * 100) / 100
}

export const HINT_EVERY_STREAK_DAYS = 3
export const SECOND_CHANCE_EVERY_STREAK_DAYS = 7
export const MAX_HINTS_PER_SESSION = 2

// El nivel n empieza en 50·n·(n−1) XP: 0, 100, 300, 600, 1000…
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

const LEVEL_TITLES = ['Recién llegado', 'Curioso', 'Aprendiz', 'Constante', 'Estudioso', 'Avanzado', 'Experto', 'Maestro', 'Leyenda']

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1]
}
