// Logros: cada uno se desbloquea cuando su valor llega a la meta.

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
  levelsComplete: string[]
  playerLevel: number
}

export interface AchievementDefinition {
  id: string
  icon: string
  title: string
  description: string
  target: number
  value: (stats: RewardStats) => number
}

const streak = (days: number, icon: string, title: string): AchievementDefinition => ({
  id: `racha-${days}`,
  icon,
  title,
  description: `Llegá a una racha de ${days} días.`,
  target: days,
  value: (s) => s.bestStreak
})

const level = (cefr: string, icon: string): AchievementDefinition => ({
  id: `nivel-${cefr.toLowerCase()}`,
  icon,
  title: `${cefr} completo`,
  description: `Aprobá todos los tópicos de ${cefr}.`,
  target: 1,
  value: (s) => (s.levelsComplete.includes(cefr) ? 1 : 0)
})

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'primer-paso', icon: '🧭', title: 'Primer paso', description: 'Hacé el examen inicial.', target: 1, value: (s) => (s.placementDone ? 1 : 0) },
  { id: 'primera-practica', icon: '✏️', title: 'Manos a la obra', description: 'Completá tu primera práctica.', target: 1, value: (s) => s.practices },
  streak(3, '🔥', 'En marcha'),
  streak(7, '🔥', 'Semana imparable'),
  streak(15, '🔥', 'Constancia de hierro'),
  streak(30, '🔥', 'Hábito formado'),
  { id: 'semana-perfecta', icon: '🌟', title: 'Semana perfecta', description: 'Completá las 5 prácticas de una semana sin faltas.', target: 1, value: (s) => s.perfectWeeks },
  { id: 'examen-aprobado', icon: '🎓', title: '¡Aprobado!', description: 'Aprobá un examen semanal.', target: 1, value: (s) => s.weeklyPassed },
  { id: 'nota-10', icon: '💯', title: 'Diez puntos', description: 'Sacá 10 en un examen semanal.', target: 1, value: (s) => s.perfectGrades },
  { id: 'remontada', icon: '💪', title: 'Remontada', description: 'Aprobá un tópico que habías reprobado.', target: 1, value: (s) => s.comebacks },
  { id: 'recuperacion', icon: '↩️', title: 'Nunca es tarde', description: 'Recuperá una falta un domingo.', target: 1, value: (s) => s.recoveries },
  { id: 'practicas-25', icon: '📚', title: 'Veinticinco', description: 'Completá 25 prácticas.', target: 25, value: (s) => s.practices },
  { id: 'practicas-100', icon: '🏛️', title: 'Cien prácticas', description: 'Completá 100 prácticas.', target: 100, value: (s) => s.practices },
  { id: 'ejercicios-200', icon: '🎯', title: 'Doscientos ejercicios', description: 'Respondé 200 ejercicios.', target: 200, value: (s) => s.exercisesAnswered },
  { id: 'simulacro', icon: '🧪', title: 'Ensayo general', description: 'Hacé un simulacro.', target: 1, value: (s) => s.mocks },
  { id: 'lector', icon: '📖', title: 'Lector curioso', description: 'Generá 5 resúmenes.', target: 5, value: (s) => s.aiSummaries },
  { id: 'critico', icon: '⭐', title: 'Buen crítico', description: 'Calificá 20 ejercicios o resúmenes.', target: 20, value: (s) => s.ratings },
  level('A1', '🥉'),
  level('A2', '🥈'),
  { id: 'jugador-5', icon: '🏆', title: 'Nivel 5', description: 'Llegá al nivel 5 de jugador.', target: 5, value: (s) => s.playerLevel }
]
