import { app, BrowserWindow, ipcMain, powerMonitor, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { watchDayChange } from './day-watcher'
import { openDatabase } from './db/database'
import { loadSettings } from './db/settings-repo'
import { registerIpc } from './ipc'
import { applyStyle, styleHash, windowColor } from './window-style'
import { IPC } from '../shared/ipc'
import type { AppSettings } from '../shared/settings'

// Carpeta de datos fija: la versión instalada y la de desarrollo comparten el mismo progreso.
app.setPath('userData', join(app.getPath('appData'), 'enhome'))
app.setAppUserModelId('com.artemis18.enhome')

// La app se llamaba «Proyecto Inglés»: si quedó progreso guardado con ese nombre, se trae una sola vez.
function migrateOldData(): string {
  const file = 'enhome.db'
  const target = join(app.getPath('userData'), file)
  const anterior = join(app.getPath('appData'), 'proyecto-ingles', 'proyecto-ingles.db')
  if (existsSync(target) || !existsSync(anterior)) return file

  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    // El diario (-wal) puede tener cambios que todavía no pasaron a la base.
    for (const sufijo of ['', '-wal', '-shm']) {
      if (existsSync(anterior + sufijo)) copyFileSync(anterior + sufijo, target + sufijo)
    }
  } catch (error) {
    console.error('No se pudo traer el progreso guardado con el nombre anterior', error)
  }
  return file
}

function createWindow(settings: AppSettings): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Enhome',
    // Barra propia: los botones y el color los dibuja la app, que sabe el estilo elegido.
    frame: false,
    roundedCorners: true,
    // Instalada, el ícono sale del ejecutable; esto lo muestra también en desarrollo.
    icon: join(__dirname, '../../resources/icon.png'),
    backgroundColor: windowColor(settings),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  const sendState = (): void => win.webContents.send(IPC.windowState, win.isMaximized())
  win.on('maximize', sendState)
  win.on('unmaximize', sendState)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${styleHash(settings)}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: styleHash(settings) })
  }
  return win
}

function currentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
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
    const db = openDatabase(join(app.getPath('userData'), migrateOldData()))
    app.on('will-quit', () => db.close())

    // En desarrollo el temario se lee del repo; instalada, de los recursos de la app.
    const contentDir = is.dev ? join(app.getAppPath(), 'content') : join(process.resourcesPath, 'content')
    // Al cambiar el estilo se repintan la ventana, el ícono de la barra de tareas y el del escritorio.
    const { today } = registerIpc(db, contentDir, is.dev, (settings) => {
      const win = currentWindow()
      if (win) applyStyle(win, settings)
    })

    ipcMain.on(IPC.windowMinimize, () => currentWindow()?.minimize())
    ipcMain.on(IPC.windowMaximizeToggle, () => {
      const win = currentWindow()
      if (!win) return
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    })
    ipcMain.on(IPC.windowClose, () => currentWindow()?.close())

    // Avisa a la interfaz cuando cambia el día para que se actualice sola.
    const dayWatcher = watchDayChange(today, (date) => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.dayChanged, date)
    })
    powerMonitor.on('resume', dayWatcher.check)
    app.on('will-quit', dayWatcher.stop)

    const settings = loadSettings(db)
    applyStyle(createWindow(settings), settings)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length > 0) return
      const current = loadSettings(db)
      applyStyle(createWindow(current), current)
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
