import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type Result } from '../shared/ipc'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const api: Api = {
  getAppInfo: () => invoke(IPC.appInfo),
  getClaudeStatus: () => invoke(IPC.claudeStatus),
  sampleSentence: () => invoke(IPC.claudeSample),
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  getCurriculum: () => invoke(IPC.curriculumList),
  getProgress: () => invoke(IPC.progressGet),
  completePracticeUnit: (unitId) => invoke(IPC.practiceComplete, unitId),
  recordRecoverySession: () => invoke(IPC.recoveryRecord),
  startPlacement: () => invoke(IPC.placementStart),
  getPlacement: () => invoke(IPC.placementGet),
  answerPlacement: (questionId, choice) => invoke(IPC.placementAnswer, questionId, choice),
  devSetToday: (date) => invoke(IPC.devSetToday, date),
  devSimulateExam: (grade) => invoke(IPC.devSimulateExam, grade),
  devResetProgress: () => invoke(IPC.devResetProgress)
}

contextBridge.exposeInMainWorld('api', api)
