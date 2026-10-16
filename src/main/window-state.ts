// Recuerda el tamaño, la posición y si la ventana estaba maximizada entre una apertura y otra.

import { readFileSync, writeFileSync } from 'node:fs'
import type { BrowserWindow, Rectangle } from 'electron'
import { z } from 'zod'

const DEFAULT_SIZE = { width: 1200, height: 800 }

const stateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  maximized: z.boolean()
})

export type WindowState = z.infer<typeof stateSchema>

export interface InitialBounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

// Una ventana guardada en una pantalla que ya no está conectada abriría fuera de la vista:
// se acepta solo si una parte razonable cae dentro de alguna pantalla actual.
export function isVisible(bounds: Rectangle, displays: Rectangle[]): boolean {
  const MIN_VISIBLE = 100
  return displays.some((area) => {
    const width = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    const height = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    return width >= MIN_VISIBLE && height >= MIN_VISIBLE
  })
}

export function initialBounds(saved: WindowState | null, displays: Rectangle[]): InitialBounds {
  if (!saved) return { ...DEFAULT_SIZE, maximized: false }
  if (!isVisible(saved, displays)) return { width: saved.width, height: saved.height, maximized: saved.maximized }
  return saved
}

export function readWindowState(path: string): WindowState | null {
  try {
    return stateSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return null
  }
}

// Guarda al mover o cambiar el tamaño (con una pausa, para no escribir en cada píxel) y al cerrar.
export function trackWindowState(win: BrowserWindow, path: string): void {
  let timer: NodeJS.Timeout | undefined
  const save = (): void => {
    clearTimeout(timer)
    if (win.isDestroyed() || win.isMinimized()) return
    // Maximizada se guarda el tamaño normal, para volver a él al desmaximizar.
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    const state: WindowState = { ...bounds, maximized: win.isMaximized() }
    try {
      writeFileSync(path, JSON.stringify(state))
    } catch (error) {
      console.error('No se pudo guardar el tamaño de la ventana', error)
    }
  }
  const later = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  win.on('resize', later)
  win.on('move', later)
  win.on('maximize', later)
  win.on('unmaximize', later)
  win.on('close', save)
}
