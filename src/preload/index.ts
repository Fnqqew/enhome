import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type Result } from '../shared/ipc'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const api: Api = {
  getClaudeStatus: () => invoke(IPC.claudeStatus),
  sampleSentence: () => invoke(IPC.claudeSample),
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  getCurriculum: () => invoke(IPC.curriculumList)
}

contextBridge.exposeInMainWorld('api', api)
