// Estado del armazón de la app que las secciones pueden tocar (por ahora, el modo enfoque).

import { createContext, useContext } from 'react'

export interface ShellState {
  // En el modo enfoque se esconde la barra lateral y queda solo el ejercicio.
  focus: boolean
  setFocus: (focus: boolean) => void
}

export const ShellContext = createContext<ShellState>({ focus: false, setFocus: () => undefined })

export function useShell(): ShellState {
  return useContext(ShellContext)
}

// Preferencias de la interfaz de esta computadora (no son del curso).
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(`enhome:${key}`)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(`enhome:${key}`, value)
  } catch {
    // Sin almacenamiento local la app funciona igual; solo no recuerda la preferencia.
  }
}
