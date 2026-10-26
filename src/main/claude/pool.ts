// Sesiones de Claude Code abiertas y libres, listas para el próximo pedido del mismo tipo.

import type { ClaudeSession } from './session'

export interface PoolOptions {
  // Cada pedido queda en la conversación de la sesión: después de unos cuantos se recicla,
  // para que no arrastre contexto viejo ni crezca sin límite.
  maxTurns: number
  // Una sesión sin usar se cierra pasado este tiempo.
  idleMs: number
  // Cuántas sesiones libres se guardan como máximo (se cierran las más viejas).
  maxIdle: number
}

export const DEFAULT_POOL_OPTIONS: PoolOptions = { maxTurns: 6, idleMs: 5 * 60_000, maxIdle: 4 }

export class SessionPool {
  private idle: ClaudeSession[] = []

  constructor(private readonly options: PoolOptions = DEFAULT_POOL_OPTIONS) {}

  // Una sesión libre y viva para ese tipo de pedido, si la hay.
  take(key: string): ClaudeSession | null {
    const index = this.idle.findIndex((s) => s.key === key && s.alive && !s.busy)
    if (index === -1) return null
    return this.idle.splice(index, 1)[0]
  }

  has(key: string): boolean {
    return this.idle.some((s) => s.key === key && s.alive)
  }

  // Devuelve una sesión que terminó bien su pedido; si ya hizo muchos, se cierra.
  give(session: ClaudeSession): void {
    if (!session.alive || session.busy || session.turns >= this.options.maxTurns) {
      session.kill()
      return
    }
    this.idle.push(session)
    while (this.idle.length > this.options.maxIdle) this.idle.shift()?.kill()
  }

  // Cierra las sesiones que llevan mucho sin usarse.
  sweep(now = Date.now()): void {
    const [old, fresh] = partition(this.idle, (s) => !s.alive || now - s.lastUsed > this.options.idleMs)
    this.idle = fresh
    for (const session of old) session.kill()
  }

  killAll(): void {
    const all = this.idle
    this.idle = []
    for (const session of all) session.kill()
  }

  get size(): number {
    return this.idle.length
  }
}

function partition<T>(items: T[], test: (item: T) => boolean): [T[], T[]] {
  const yes: T[] = []
  const no: T[] = []
  for (const item of items) (test(item) ? yes : no).push(item)
  return [yes, no]
}
