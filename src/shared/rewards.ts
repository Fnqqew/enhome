// Progreso y recompensas: nivel, racha, comodines y logros.

import type { CurriculumMap } from './curriculum'

export const POWER_UP_IDS = ['hint', 'second-chance', 'streak-shield'] as const
export type PowerUpId = (typeof POWER_UP_IDS)[number]

export interface PowerUpInfo {
  icon: string
  label: string
  description: string
  howToEarn: string
  max: number
}

export const POWER_UPS: Record<PowerUpId, PowerUpInfo> = {
  hint: {
    icon: '💡',
    label: 'Pista',
    description: 'En la práctica te da una ayuda para el ejercicio, sin darte la respuesta. Hasta 2 por práctica.',
    howToEarn: 'Cada 3 días seguidos de racha.',
    max: 5
  },
  'second-chance': {
    icon: '🔁',
    label: 'Segunda oportunidad',
    description: 'En el examen semanal te dice si una respuesta cerrada está bien antes de entregar, para que puedas corregirla. 1 por examen.',
    howToEarn: 'Cada 7 días seguidos de racha.',
    max: 3
  },
  'streak-shield': {
    icon: '🛡️',
    label: 'Protector de racha',
    description: 'Si un día no practicás, se usa solo y tu racha no se corta.',
    howToEarn: 'Cada semana perfecta: las 5 prácticas sin faltas.',
    max: 2
  }
}

export type CalendarDayStatus = 'done' | 'missed' | 'protected' | 'today' | 'rest' | 'none' | 'future'

export interface CalendarDay {
  date: string
  status: CalendarDayStatus
}

export interface AchievementView {
  id: string
  icon: string
  title: string
  description: string
  unlockedAt: string | null
  current: number
  target: number
}

export interface ProgressView {
  player: {
    level: number
    title: string
    xp: number
    xpIntoLevel: number
    xpForNextLevel: number
    streak: number
    bestStreak: number
    multiplier: number
  }
  calendar: CalendarDay[]
  inventory: (PowerUpInfo & { id: PowerUpId; quantity: number })[]
  achievements: AchievementView[]
  stats: {
    practices: number
    exercisesAnswered: number
    accuracy: number | null
    weeklyPassed: number
    averageGrade: number | null
    mocks: number
  }
  map: CurriculumMap
  recentXp: { label: string; amount: number; date: string }[]
}

export interface RewardNews {
  id: number
  kind: 'achievement' | 'level' | 'power-up' | 'streak'
  message: string
}

export interface SecondChanceView {
  available: number
  used: { index: number; correct: boolean } | null
}

export interface SecondChanceResult {
  index: number
  correct: boolean
  message: string
}

export const secondChanceMessage = (correct: boolean): string =>
  correct ? 'Tu respuesta está bien. ¡Seguí así!' : 'Esa respuesta no es correcta: cambiala antes de entregar.'
