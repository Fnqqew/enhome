// Charla con Claude: conversación libre en el idioma del curso, con la corrección de cada mensaje.

export interface ChatCorrection {
  ok: boolean
  corrected: string
  notes: string[]
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  correction: ChatCorrection | null
}

export interface ChatView {
  id: number
  title: string
  scenario: string
  level: string
  messages: ChatMessage[]
}

export interface ChatSummary {
  id: number
  title: string
  createdOn: string
  messages: number
}

export interface ChatSuggestion {
  title: string
  scenario: string
}

export const MAX_CHAT_MESSAGE = 800
