import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { openDatabase } from './db/database'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Proyecto Inglés',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161719' : '#f6f5f2',
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

app.whenReady().then(() => {
  const db = openDatabase(join(app.getPath('userData'), 'proyecto-ingles.db'))
  app.on('will-quit', () => db.close())

  // En desarrollo el temario se lee del repo; empaquetada, de los recursos de la app.
  const contentDir = is.dev ? join(app.getAppPath(), 'content') : join(process.resourcesPath, 'content')
  registerIpc(db, contentDir, is.dev)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
