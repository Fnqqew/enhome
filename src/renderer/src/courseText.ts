import type { CourseSummary } from '@shared/languages'

// Una línea con el estado de un curso, para el selector de idioma y Ajustes.
export function courseLine(course: CourseSummary | undefined): string {
  if (!course) return ''
  if (!course.available) return 'Próximamente'
  if (!course.started) return `Sin empezar · ${course.topics} tópicos`
  const where = course.topicTitle ? `${course.level} · ${course.topicTitle}` : (course.level ?? 'En curso')
  return course.paused ? `En pausa · ${where}` : where
}
