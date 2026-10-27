// La misión de la semana: una tarea real para cerrar el tópico (escribir un mail, dejar un audio,
// resolver un trámite) que Claude evalúa con una rúbrica.

export type MissionMode = 'write' | 'speak'

export interface MissionTask {
  title: string
  // Dónde y con quién, en español.
  situation: string
  // Qué hay que producir, en español y concreto.
  task: string
  mode: MissionMode
  // Qué tiene que incluir la respuesta.
  checklist: string[]
  // Con qué se evalúa: 3 o 4 criterios.
  rubric: { criterion: string; description: string }[]
  minWords: number
  maxWords: number
}

export interface MissionReview {
  // De 0 a 3 por criterio, en el orden de la rúbrica.
  criteria: { criterion: string; score: number; comment: string }[]
  comments: string
  correctedText: string
  nextStep: string
  // Porcentaje del puntaje máximo.
  percent: number
  passed: boolean
}

export interface MissionView {
  topicTitle: string
  // null mientras no se pidió (o no se puede pedir todavía).
  mission: MissionTask | null
  answer: string | null
  review: MissionReview | null
  // Por qué todavía no se puede (null si ya se puede).
  lockedReason: string | null
}

// Prácticas de la semana que hacen falta para que se habilite.
export const MISSION_AFTER_UNITS = 3
// Con cuánto (del puntaje máximo) se da por cumplida.
export const MISSION_PASS_PERCENT = 60
// Lo más que se graba en una misión hablada.
export const MISSION_RECORDING_MS = 60_000
