import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { z } from 'zod'
import { askClaude, getClaudeStatus } from './claude/bridge'
import { IPC, type SampleSentence } from '../shared/ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Proyecto Inglés',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.claudeStatus, () => getClaudeStatus())

  ipcMain.handle(IPC.claudeSample, (): Promise<SampleSentence> =>
    askClaude({
      systemPrompt: 'Sos un generador de contenido para una app de inglés para hispanohablantes. Respondé solo con lo pedido.',
      prompt: 'Dame una oración simple en inglés de nivel A1 y su traducción al español rioplatense.',
      schema: z.object({ english: z.string(), spanish: z.string() })
    })
  )
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
