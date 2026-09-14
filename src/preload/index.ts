import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/ipc'

const api: Api = {
  getClaudeStatus: () => ipcRenderer.invoke(IPC.claudeStatus),
  sampleSentence: () => ipcRenderer.invoke(IPC.claudeSample)
}

contextBridge.exposeInMainWorld('api', api)
