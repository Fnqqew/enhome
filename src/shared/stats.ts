// Estadísticas del curso: cómo vienen los aciertos, la constancia y las notas.

import type { Skill } from './curriculum'

export interface StatsView {
  // Aciertos por habilidad: en total y en las últimas cuatro semanas.
  skills: { skill: Skill; answered: number; accuracy: number | null; recentAccuracy: number | null }[]
  topics: { topicId: string; title: string; level: string; answered: number; accuracy: number | null; bestGrade: number | null }[]
  // Prácticas terminadas por semana (las últimas 12, de la más vieja a la más nueva).
  weeks: { weekStart: string; practices: number }[]
  exams: { date: string; grade: number; passed: boolean; kind: 'weekly' | 'mock' }[]
  // Actividad por día de los últimos 182 días: prácticas, juegos, diario y lecturas.
  activity: { date: string; count: number }[]
  totals: { answered: number; accuracy: number | null; studyDays: number; games: number }
}
