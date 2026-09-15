import { app, BrowserWindow, nativeTheme, powerMonitor, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { watchDayChange } from './day-watcher'
import { openDatabase } from './db/database'
import { registerIpc } from './ipc'
import { IPC } from '../shared/ipc'

// Carpeta de datos fija: la versión instalada y la de desarrollo comparten el mismo progreso.
app.setPath('userData', join(app.getPath('appData'), 'proyecto-ingles'))
app.setAppUserModelId('com.artemis18.proyectoingles')

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

// Una sola instancia: dos ventanas escribiendo la misma base se pisarían.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    const db = openDatabase(join(app.getPath('userData'), 'proyecto-ingles.db'))
    app.on('will-quit', () => db.close())

    // En desarrollo el temario se lee del repo; instalada, de los recursos de la app.
    const contentDir = is.dev ? join(app.getAppPath(), 'content') : join(process.resourcesPath, 'content')
    const { today } = registerIpc(db, contentDir, is.dev)

    // Avisa a la interfaz cuando cambia el día para que se actualice sola.
    const dayWatcher = watchDayChange(today, (date) => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.dayChanged, date)
    })
    powerMonitor.on('resume', dayWatcher.check)
    app.on('will-quit', dayWatcher.stop)

    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
