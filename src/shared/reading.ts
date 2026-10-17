// Lecturas graduadas y diario en el idioma del curso.

export const READING_THEMES = ['Vida cotidiana', 'Viajes', 'Misterio', 'Humor', 'Trabajo', 'Cultura y costumbres'] as const

export interface ReadingQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface ReadingView {
  id: number
  title: string
  level: string
  topicId: string
  topicTitle: string | null
  text: string
  glossary: { term: string; translation: string }[]
  questions: ReadingQuestion[]
  // Lo que respondió el alumno (null si todavía no respondió).
  answers: number[] | null
  score: number | null
  createdOn: string
}

export interface ReadingSummary {
  id: number
  title: string
  level: string
  score: number | null
  questions: number
  createdOn: string
}

export interface JournalReview {
  correctedText: string
  comments: string
  mistakes: { fragment: string; correction: string; explanation: string }[]
  // Una expresión o palabra para sumar al vocabulario, con su traducción.
  tip: string
  score: number
}

export interface JournalEntry {
  day: string
  text: string
  review: JournalReview | null
  // Si el texto cambió después de la corrección.
  edited: boolean
}

export interface JournalView {
  today: JournalEntry | null
  past: JournalEntry[]
  streak: number
  prompts: string[]
}

export const MAX_JOURNAL_LENGTH = 3000

// Un fragmento resaltado en el modo lectura, con su nota.
export interface Highlight {
  id: number
  text: string
  note: string
}
