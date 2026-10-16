// Logros: cada uno se desbloquea cuando su valor llega a la meta.

import type { IconName } from '../../shared/icons'

export interface RewardStats {
  placementDone: boolean
  practices: number
  exercisesAnswered: number
  ratings: number
  bestStreak: number
  perfectWeeks: number
  weeklyPassed: number
  perfectGrades: number
  comebacks: number
  recoveries: number
  mocks: number
  aiSummaries: number
  games: number
  learnedMistakes: number
  levelsComplete: string[]
  playerLevel: number
}

export interface AchievementDefinition {
  id: string
  icon: IconName
  title: string
  description: string
  target: number
  value: (stats: RewardStats) => number
}

const streak = (days: number, icon: IconName, title: string): AchievementDefinition => ({
  id: `racha-${days}`,
  icon,
  title,
  description: `Llegá a una racha de ${days} días.`,
  target: days,
  value: (s) => s.bestStreak
})

const level = (cefr: string, icon: IconName): AchievementDefinition => ({
  id: `nivel-${cefr.toLowerCase()}`,
  icon,
  title: `${cefr} completo`,
  description: `Aprobá todos los tópicos de ${cefr}.`,
  target: 1,
  value: (s) => (s.levelsComplete.includes(cefr) ? 1 : 0)
})

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'primer-paso', icon: 'compass', title: 'Primer paso', description: 'Hacé el examen inicial.', target: 1, value: (s) => (s.placementDone ? 1 : 0) },
  { id: 'primera-practica', icon: 'pencil', title: 'Manos a la obra', description: 'Completá tu primera práctica.', target: 1, value: (s) => s.practices },
  streak(3, 'flame', 'En marcha'),
  streak(7, 'flame', 'Semana imparable'),
  streak(15, 'flame', 'Constancia de hierro'),
  streak(30, 'flame', 'Hábito formado'),
  { id: 'semana-perfecta', icon: 'sparkle', title: 'Semana perfecta', description: 'Completá las 5 prácticas de una semana sin faltas.', target: 1, value: (s) => s.perfectWeeks },
  { id: 'examen-aprobado', icon: 'cap', title: '¡Aprobado!', description: 'Aprobá un examen semanal.', target: 1, value: (s) => s.weeklyPassed },
  { id: 'nota-10', icon: 'target', title: 'Diez puntos', description: 'Sacá 10 en un examen semanal.', target: 1, value: (s) => s.perfectGrades },
  { id: 'remontada', icon: 'trend', title: 'Remontada', description: 'Aprobá un tópico que habías reprobado.', target: 1, value: (s) => s.comebacks },
  { id: 'recuperacion', icon: 'calendar', title: 'Nunca es tarde', description: 'Recuperá una falta un domingo.', target: 1, value: (s) => s.recoveries },
  { id: 'practicas-25', icon: 'book', title: 'Veinticinco', description: 'Completá 25 prácticas.', target: 25, value: (s) => s.practices },
  { id: 'practicas-100', icon: 'landmark', title: 'Cien prácticas', description: 'Completá 100 prácticas.', target: 100, value: (s) => s.practices },
  { id: 'ejercicios-200', icon: 'check', title: 'Doscientos ejercicios', description: 'Respondé 200 ejercicios.', target: 200, value: (s) => s.exercisesAnswered },
  { id: 'simulacro', icon: 'flask', title: 'Ensayo general', description: 'Hacé un simulacro.', target: 1, value: (s) => s.mocks },
  { id: 'lector', icon: 'page', title: 'Lector curioso', description: 'Generá 5 resúmenes.', target: 5, value: (s) => s.aiSummaries },
  { id: 'critico', icon: 'star', title: 'Buen crítico', description: 'Calificá 20 ejercicios o resúmenes.', target: 20, value: (s) => s.ratings },
  level('A1', 'medal'),
  level('A2', 'medal'),
  { id: 'jugador-5', icon: 'trophy', title: 'Nivel 5', description: 'Llegá al nivel 5 de jugador.', target: 5, value: (s) => s.playerLevel },
  { id: 'juegos-10', icon: 'sparkle', title: 'A jugar', description: 'Jugá 10 partidas en Juegos.', target: 10, value: (s) => s.games },
  { id: 'aprendidos-10', icon: 'repaso', title: 'Memoria de elefante', description: 'Aprendé 10 errores del cuaderno.', target: 10, value: (s) => s.learnedMistakes }
]
