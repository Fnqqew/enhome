// Reglas de las pruebas (ver docs/documento-base.md).

export const WEEKLY_EXAM_SIZE = 20
export const MOCK_EXAM_SIZE = 10

// Pausa única si se interrumpe el examen semanal.
export const PAUSE_LIMIT_MS = 30 * 60_000
// Sin señales de la interfaz durante este tiempo, el examen se considera interrumpido.
export const HEARTBEAT_TIMEOUT_MS = 60_000

// Preguntas que se pueden descartar por no pasar los controles sin rehacer el examen.
export const MAX_DROPPED_ITEMS = 2

// En la práctica, un subtema con más de este porcentaje de errores recibe preguntas más exigentes.
export const WEAK_SUBTOPIC_RATE = 0.3
