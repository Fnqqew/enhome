// Vocabulario guardado: palabras o expresiones con su traducción, repasadas con tarjetas.

export interface WordInfo {
  term: string
  translation: string
  example: string
  exampleEs: string
  note: string
}

export interface VocabCard extends WordInfo {
  id: number
  // Qué tan firme está en la memoria (0 a 3), según FSRS.
  stage: number
  dueOn: string
  createdOn: string
}

export interface VocabOverview {
  cards: VocabCard[]
  dueToday: number
}

export const MAX_TERM_LENGTH = 60
