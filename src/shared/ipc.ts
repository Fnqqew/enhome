// Contrato entre el proceso principal y la interfaz.

import type { CurriculumTopic } from './curriculum'
import type { AppInfo, PlacementView, ProgressState } from './progress'
import type { AppSettings } from './settings'

export const IPC = {
  appInfo: 'app:info',
  claudeStatus: 'claude:status',
  claudeSample: 'claude:sample',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  curriculumList: 'curriculum:list',
  progressGet: 'progress:get',
  practiceComplete: 'practice:complete',
  recoveryRecord: 'recovery:record',
  placementStart: 'placement:start',
  placementGet: 'placement:get',
  placementAnswer: 'placement:answer',
  devSetToday: 'dev:set-today',
  devSimulateExam: 'dev:simulate-exam',
  devResetProgress: 'dev:reset-progress'
} as const

// Todas las respuestas IPC viajan envueltas para que los errores lleguen limpios a la interfaz.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

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
  getAppInfo(): Promise<AppInfo>
  getClaudeStatus(): Promise<ClaudeStatus>
  sampleSentence(): Promise<SampleSentence>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getCurriculum(): Promise<CurriculumTopic[]>
  getProgress(): Promise<ProgressState>
  completePracticeUnit(unitId: number): Promise<ProgressState>
  recordRecoverySession(): Promise<ProgressState>
  startPlacement(): Promise<PlacementView>
  getPlacement(): Promise<PlacementView>
  answerPlacement(questionId: string, choice: number): Promise<PlacementView>
  // Solo en desarrollo.
  devSetToday(date: string | null): Promise<ProgressState>
  devSimulateExam(grade: number): Promise<ProgressState>
  devResetProgress(): Promise<ProgressState>
}
