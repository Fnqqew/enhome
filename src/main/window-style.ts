// El estilo elegido pinta la ventana, el ícono de la barra de tareas y el del acceso directo del escritorio.

import { app, nativeImage, nativeTheme, type BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { STYLES, type AppSettings, type StyleId } from '../shared/settings'

export function windowColor(settings: AppSettings): string {
  const style = STYLES.find((s) => s.id === settings.style) ?? STYLES[0]
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)
  return dark ? style.window.dark : style.window.light
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
// El nombre se busca con comodín para no escribir la tilde de «Inglés» dentro del script.
function updateShortcuts(style: StyleId): void {
  const ico = process.platform === 'win32' ? stableIcon(style) : null
  if (!ico) return

  const script = `
    $w = New-Object -ComObject WScript.Shell
    $carpetas = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))
    foreach ($c in $carpetas) {
      Get-ChildItem -LiteralPath $c -Filter 'Proyecto Ingl*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
        $s = $w.CreateShortcut($_.FullName)
        $s.IconLocation = ${quote(ico)}
        $s.Save()
      }
    }`
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (error) => {
    if (error) console.error('No se pudo cambiar el ícono del acceso directo', error)
  })
}

export function applyStyle(win: BrowserWindow, settings: AppSettings): void {
  const png = iconPng(settings.style)
  if (existsSync(png)) win.setIcon(nativeImage.createFromPath(png))
  win.setBackgroundColor(windowColor(settings))
  updateShortcuts(settings.style)
}
