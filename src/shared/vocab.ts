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
  // Una palabra guardada, una frase hecha de un subtema (se repasa con la oración de ejemplo y un hueco) o
  // una oración entera guardada de una lectura.
  kind: 'word' | 'phrase' | 'sentence'
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
// Una oración guardada de una lectura, entera.
export const MAX_SENTENCE_LENGTH = 300
