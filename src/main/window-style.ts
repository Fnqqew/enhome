// El estilo elegido pinta la ventana, el ícono de la barra de tareas y el del acceso directo del escritorio.

import { app, nativeImage, nativeTheme, type BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { STYLES, type AppSettings, type StyleId } from '../shared/settings'

export function isDark(settings: AppSettings): boolean {
  return settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)
}

// El color de fondo de la ventana es el de la pantalla de carga, para que no se vea un parpadeo al abrir.
export function windowColor(settings: AppSettings): string {
  const style = STYLES.find((s) => s.id === settings.style) ?? STYLES[0]
  return (isDark(settings) ? style.preview.dark : style.preview.light).bg
}

// Viaja en la dirección de la página para que el estilo se aplique antes de que cargue la interfaz.
export function styleHash(settings: AppSettings): string {
  return `style=${settings.style}&theme=${isDark(settings) ? 'dark' : 'light'}`
}

function iconPng(style: StyleId): string {
  return join(app.getAppPath(), 'resources/icons', `${style}.png`)
}

// Los .ico quedan fuera del asar: un acceso directo de Windows no puede apuntar adentro.
function iconIco(style: StyleId): string {
  const dir = app.isPackaged ? join(process.resourcesPath, 'icons') : join(app.getAppPath(), 'build/icons')
  return join(dir, `${style}.ico`)
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// «IconLocation» separa el archivo del índice con una coma, así que la ruta no puede tener ninguna:
// el ícono se copia a la carpeta de datos, que siempre tiene un nombre limpio.
function stableIcon(style: StyleId): string | null {
  const source = iconIco(style)
  if (!existsSync(source)) return null
  const dir = join(app.getPath('userData'), 'iconos')
  const target = join(dir, `${style}.ico`)
  try {
    mkdirSync(dir, { recursive: true })
    copyFileSync(source, target)
    return target
  } catch (error) {
    console.error('No se pudo preparar el ícono del estilo', error)
    return null
  }
}

// Los accesos directos se editan con WScript.Shell, la única forma de tocar un .lnk.
// Las carpetas las resuelve Windows: el escritorio puede estar redirigido a OneDrive.
// Se buscan por nombre, incluidos los de la versión anterior de la app.
// Se actualizan el del escritorio, el del menú Inicio y el anclado a la barra de tareas.
function updateShortcuts(ico: string): void {
  if (process.platform !== 'win32') return

  const script = `
    $w = New-Object -ComObject WScript.Shell
    $carpetas = @(
      [Environment]::GetFolderPath('Desktop'),
      (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'),
      (Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar')
    )
    foreach ($c in $carpetas) {
      Get-ChildItem -Path (Join-Path $c '*') -Include 'Enhome*.lnk', 'Proyecto Ingl*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
        $s = $w.CreateShortcut($_.FullName)
        $s.IconLocation = ${quote(ico)}
        $s.Save()
      }
    }
    # Windows guarda los íconos en caché: esto le avisa que los vuelva a leer.
    Start-Process -FilePath "$env:SystemRoot\\System32\\ie4uinit.exe" -ArgumentList '-show' -WindowStyle Hidden`
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (error) => {
    if (error) console.error('No se pudo cambiar el ícono del acceso directo', error)
  })
}

// Cada ajuste que se guarda pasa por acá, pero los íconos solo se tocan cuando cambia el estilo:
// reescribir los accesos directos lanza PowerShell y no tiene sentido hacerlo por un cambio de letra.
const windowIcons = new WeakMap<BrowserWindow, StyleId>()
let shortcutsStyle: StyleId | null = null

export function applyStyle(win: BrowserWindow, settings: AppSettings): void {
  win.setBackgroundColor(windowColor(settings))
  if (windowIcons.get(win) === settings.style) return
  windowIcons.set(win, settings.style)

  // El .ico trae varios tamaños y la barra de tareas elige el que necesita; el .png es el respaldo.
  const ico = stableIcon(settings.style)
  const icon = ico ?? iconPng(settings.style)
  if (existsSync(icon)) win.setIcon(nativeImage.createFromPath(icon))

  // Una vez por arranque (una reinstalación pudo haberlos pisado) y después solo si cambia el estilo.
  if (ico && shortcutsStyle !== settings.style) {
    shortcutsStyle = settings.style
    updateShortcuts(ico)
  }
}
