// Contrato entre el proceso principal y la interfaz.

export const IPC = {
  claudeStatus: 'claude:status',
  claudeSample: 'claude:sample'
} as const

export type ClaudeStatus =
  | { state: 'ready'; subscription: string | null; email: string | null }
  | { state: 'not-installed' }
  | { state: 'logged-out' }
  | { state: 'no-subscription'; authMethod: string }
  | { state: 'error'; message: string }

export interface SampleSentence {
  english: string
  spanish: string
}

export interface Api {
  getClaudeStatus(): Promise<ClaudeStatus>
  sampleSentence(): Promise<SampleSentence>
}
