// Recordatorio diario (notificación de Windows) y bandeja del sistema.

import { Menu, Notification, Tray, nativeImage } from 'electron'
import type { GoalView } from '../shared/goal'
import type { AppSettings } from '../shared/settings'

export interface DayStatus {
  practicePending: boolean
  goal: GoalView
}

// A la hora elegida, si falta la práctica del día o la meta, avisa una vez. A las 23 vuelve a
// avisar si la meta sigue sin cumplirse.
export function startReminders(
  settings: () => AppSettings,
  status: () => DayStatus | null,
  today: () => string,
  open: (section: 'practica' | 'inicio') => void
): () => void {
  const sent = new Set<string>()
  const check = (): void => {
    const s = settings()
    if (!s.reminderEnabled || !Notification.isSupported()) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const slot = hhmm === s.reminderTime ? 'hora' : hhmm === '23:00' ? 'noche' : null
    if (!slot) return
    const key = `${today()}:${slot}`
    if (sent.has(key)) return
    sent.add(key)
    const day = status()
    if (!day) return
    let body: string | null = null
    if (slot === 'hora' && day.practicePending) body = 'Te falta la práctica de hoy. Son unos minutos y la racha sigue.'
    else if (!day.goal.met && day.goal.kind !== 'off') {
      const left = day.goal.target - day.goal.done
      body =
        day.goal.kind === 'minutes'
          ? `Te ${left === 1 ? 'falta 1 minuto' : `faltan ${left} minutos`} para tu meta de hoy.`
          : `Te ${left === 1 ? 'falta 1 actividad' : `faltan ${left} actividades`} para tu meta de hoy.`
    }
    if (!body) return
    const notification = new Notification({ title: 'Enhome', body })
    notification.on('click', () => open(day.practicePending ? 'practica' : 'inicio'))
    notification.show()
  }
  const timer = setInterval(check, 20_000)
  return () => clearInterval(timer)
}

// Ícono en la bandeja: abrir, practicar o salir. Con la bandeja activa, cerrar la ventana solo la esconde.
export class TrayIcon {
  private tray: Tray | null = null

  constructor(
    private readonly open: (section?: 'practica') => void,
    private readonly quit: () => void
  ) {}

  update(enabled: boolean, icon: string): void {
    if (!enabled) {
      this.tray?.destroy()
      this.tray = null
      return
    }
    const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
    if (!this.tray) {
      this.tray = new Tray(image)
      this.tray.setToolTip('Enhome')
      this.tray.on('click', () => this.open())
      this.tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Abrir Enhome', click: () => this.open() },
          { label: 'Practicar', click: () => this.open('practica') },
          { type: 'separator' },
          { label: 'Salir', click: () => this.quit() }
        ])
      )
    } else {
      this.tray.setImage(image)
    }
  }
}
