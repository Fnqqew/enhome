// Registro de errores en un archivo: lo que antes solo se veía en la terminal queda guardado
// para poder diagnosticar un problema sin herramientas («Abrir registro» en Acerca de).

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { format } from 'node:util'

const MAX_BYTES = 1024 * 1024

let logPath: string | null = null

export function currentLogPath(): string | null {
  return logPath
}

// Al pasar de 1 MB, el registro actual pasa a ser el anterior (.old.log) y se empieza otro.
function rotate(path: string): void {
  try {
    if (existsSync(path) && statSync(path).size > MAX_BYTES) renameSync(path, path.replace(/\.log$/, '.old.log'))
  } catch {
    // Si no se puede rotar se sigue escribiendo en el mismo archivo.
  }
}

export function writeLog(level: 'error' | 'warn' | 'info', args: unknown[]): void {
  if (!logPath) return
  const line = `${new Date().toISOString()} [${level}] ${format(...args)}\n`
  try {
    appendFileSync(logPath, line)
  } catch {
    // Un registro que falla no debe romper la app.
  }
}

export function startLog(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  rotate(path)
  logPath = path

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      writeLog(level, args)
    }
  }
  process.on('uncaughtException', (error) => console.error('Error no controlado', error))
  process.on('unhandledRejection', (reason) => console.error('Promesa rechazada sin controlar', reason))
  writeLog('info', ['Enhome inició'])
}
