// Vocabulario guardado: palabras o expresiones con su traducción, repasadas con tarjetas.

// Días hasta la próxima vez según cuántas veces seguidas te la supiste.
export const VOCAB_INTERVALS = [1, 3, 7, 15, 30, 60] as const

export interface WordInfo {
  term: string
  translation: string
  example: string
  exampleEs: string
  note: string
}

export interface VocabCard extends WordInfo {
  id: number
  stage: number
  dueOn: string
  createdOn: string
}

export interface VocabOverview {
  cards: VocabCard[]
  dueToday: number
}

export const MAX_TERM_LENGTH = 60
