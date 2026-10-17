import { app, BrowserWindow, ipcMain, powerMonitor, screen, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
import { registerModelScheme, serveModels } from './models'
import { DataManager } from './data/data'
import { startReminders, TrayIcon } from './reminders'
import { IPC } from '../shared/ipc'
import type { AppSettings } from '../shared/settings'

// Carpeta de datos fija: la versión instalada y la de desarrollo comparten el mismo progreso.
app.setPath('userData', join(app.getPath('appData'), 'enhome'))
app.setAppUserModelId('com.artemis18.enhome')
startLog(join(app.getPath('userData'), 'logs', 'enhome.log'))
registerModelScheme()

const windowStatePath = (): string => join(app.getPath('userData'), 'ventana.json')

// La app se llamaba «Proyecto Inglés»: si quedó progreso guardado con ese nombre, se trae una sola vez.
function migrateOldData(): string {
  const file = 'enhome.db'
  const target = join(app.getPath('userData'), file)
  const anterior = join(app.getPath('appData'), 'proyecto-ingles', 'proyecto-ingles.db')
  // Se intenta una sola vez: si después se borran los datos, no vuelve a traer lo viejo.
  const marker = join(app.getPath('userData'), 'migracion-revisada')
  if (existsSync(marker)) return file
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(marker, new Date().toISOString())
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

let quitting = false

function createWindow(settings: AppSettings, hidden = false): BrowserWindow {
  const bounds = initialBounds(
    readWindowState(windowStatePath()),
    screen.getAllDisplays().map((display) => display.workArea)
  )
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    // Con ventanas angostas la barra lateral se pliega sola.
    minWidth: 720,
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
  win.on('ready-to-show', () => {
    if (hidden) return
    if (bounds.maximized) win.maximize()
    else win.show()
  })
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
    // Pudo haber quedado escondida en la bandeja.
    win.show()
    win.focus()
  })

  app.whenReady().then(() => {
    serveModels()
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
    app.on('will-quit', () =>
      courseDbs.forEach((course) => {
        try {
          course.close()
        } catch {
          // Ya estaba cerrada (por ejemplo, después de restaurar una copia).
        }
      })
    )
    const data = new DataManager({ dataDir, openDbs: courseDbs, courseDb })

    // En desarrollo el temario se lee del repo; instalada, de los recursos de la app.
    const contentDir = is.dev ? join(app.getAppPath(), 'content') : join(process.resourcesPath, 'content')
    const { today, warmUp, dayStatus } = registerIpc({
      db,
      courseDb,
      courseExists: (language) => language === 'en' || existsSync(coursePath(language)),
      contentDir,
      isDev: is.dev,
      data,
      // Al cambiar el estilo se repintan la ventana, el ícono de la barra de tareas y el del escritorio.
      onSettingsChange: (settings) => {
        const win = currentWindow()
        if (win) applyStyle(win, settings)
        applySystem(settings)
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
      warmUp()
    })
    powerMonitor.on('resume', dayWatcher.check)
    app.on('will-quit', dayWatcher.stop)

    // Bandeja del sistema y arranque con Windows (minimizada en la bandeja).
    const showSection = (section?: string): void => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      if (section) win.webContents.send(IPC.navigate, section)
    }
    const tray = new TrayIcon(showSection, () => {
      quitting = true
      app.quit()
    })
    const applySystem = (current: AppSettings): void => {
      tray.update(current.tray, join(app.getAppPath(), 'resources/icons', `${current.style}.png`))
      // Solo instalada: en desarrollo registraría el Electron del repo.
      if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: current.startWithWindows, args: ['--oculta'] })
    }
    startReminders(() => loadSettings(db), dayStatus, today, showSection)

    const settings = loadSettings(db)
    applySystem(settings)
    // Al arrancar con Windows la ventana queda escondida en la bandeja.
    const startHidden = process.argv.includes('--oculta') && settings.tray
    const mainWindow = createWindow(settings, startHidden)
    applyStyle(mainWindow, settings)
    // Con la bandeja activa, cerrar la ventana la esconde en vez de salir.
    mainWindow.on('close', (event) => {
      if (!quitting && loadSettings(db).tray) {
        event.preventDefault()
        mainWindow.hide()
      }
    })
    app.on('before-quit', () => {
      quitting = true
    })
    // Unos segundos después de abrir, para no competir con la carga de la ventana.
    setTimeout(warmUp, 6_000)
    // Una copia de seguridad por día de cada curso.
    setTimeout(() => {
      try {
        data.backup(today())
      } catch (error) {
        console.error('No se pudo hacer la copia de seguridad', error)
      }
    }, 15_000)
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
