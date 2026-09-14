// Reglas del producto (ver docs/documento-base.md). Cambiarlas acá cambia el comportamiento de toda la app.

export const PRACTICE_DAYS = 5
export const PASS_GRADE = 8
export const MAX_FALTAS = 3
// Días desde el lunes a partir de los cuales se habilita el examen semanal (4 = viernes).
export const EXAM_OPENS_ON_DAY = 4

// Un tópico anterior se marca para repaso si en un examen tiene más de este porcentaje de errores…
export const WEAK_TOPIC_ERROR_RATE = 0.4
// …con al menos esta cantidad de preguntas.
export const MIN_QUESTIONS_FOR_WEAKNESS = 2

// Con esta cantidad de reprobados, la semana de reintento arranca con repaso de prerrequisitos.
export const REVIEW_AFTER_FAILURES = 2
export const REVIEW_UNITS = 2

export const PLACEMENT_QUESTIONS_PER_TOPIC = 3
export const PLACEMENT_MIN_CORRECT = 2
