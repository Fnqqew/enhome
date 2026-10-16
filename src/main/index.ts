import { app, BrowserWindow, ipcMain, powerMonitor, screen, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { watchDayChange } from './day-watcher'
import { openDatabase, type Db } from './db/database'
import { runMaintenance } from './db/maintenance'
import { toLocalDate } from '../shared/dates'
import type { LanguageId } from '../shared/languages'
import { loadSettings } from './db/settings-repo'
import { registerIpc } from './ipc'
import { applyStyle, styleHash, windowColor } from './window-style'
import { initialBounds, readWindowState, trackWindowState } from './window-state'
import { startLog } from './log'
import { IPC } from '../shared/ipc'
import type { AppSettings } from '../shared/settings'

// Carpeta de datos fija: la versión instalada y la de desarrollo comparten el mismo progreso.
app.setPath('userData', join(app.getPath('appData'), 'enhome'))
app.setAppUserModelId('com.artemis18.enhome')
startLog(join(app.getPath('userData'), 'logs', 'enhome.log'))

const windowStatePath = (): string => join(app.getPath('userData'), 'ventana.json')

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
  const bounds = initialBounds(
    readWindowState(windowStatePath()),
    screen.getAllDisplays().map((display) => display.workArea)
  )
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
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
      // La interfaz solo habla con la app por el puente del preload.
      sandbox: true
    }
  })

  trackWindowState(win, windowStatePath())
  // Maximizar también la muestra, así no se ve un instante en el tamaño normal.
  win.on('ready-to-show', () => (bounds.maximized ? win.maximize() : win.show()))
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
    const dataDir = app.getPath('userData')
    // La base principal es la del curso de inglés y además guarda los ajustes de toda la app.
    const db = openDatabase(join(dataDir, migrateOldData()))
    runMaintenance(db, toLocalDate(new Date()))
    const courseDbs = new Map<LanguageId, Db>([['en', db]])
    const coursePath = (language: LanguageId): string => join(dataDir, `enhome-${language}.db`)
    const courseDb = (language: LanguageId): Db => {
      let course = courseDbs.get(language)
      if (!course) {
        course = openDatabase(coursePath(language))
        runMaintenance(course, toLocalDate(new Date()))
        courseDbs.set(language, course)
      }
      return course
    }
    app.on('will-quit', () => courseDbs.forEach((course) => course.close()))

    // En desarrollo el temario se lee del repo; instalada, de los recursos de la app.
    const contentDir = is.dev ? join(app.getAppPath(), 'content') : join(process.resourcesPath, 'content')
    const { today } = registerIpc({
      db,
      courseDb,
      courseExists: (language) => language === 'en' || existsSync(coursePath(language)),
      contentDir,
      isDev: is.dev,
      // Al cambiar el estilo se repintan la ventana, el ícono de la barra de tareas y el del escritorio.
      onSettingsChange: (settings) => {
        const win = currentWindow()
        if (win) applyStyle(win, settings)
      }
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
