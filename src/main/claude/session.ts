// Una sesión de Claude Code que queda abierta y responde un pedido a la vez (modo stream-json).
// Arrancar Claude Code cuesta unos 4 s; reusar una sesión abierta baja un pedido corto de unos 7 s
// a unos 2,5 s (medido el 2026-10-26). Cada sesión tiene fijos el modelo, el esfuerzo, el pedido de
// sistema y el esquema, así que se reusa solo para pedidos del mismo tipo.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { tmpdir } from 'node:os'
import { createInterface } from 'node:readline'
import { subscriptionEnv } from './cli'
import { CANCELLED_MESSAGE, ClaudeError, explainFailure, timeoutError } from './errors'

export type Spawner = (exe: string, args: string[]) => ChildProcessWithoutNullStreams

export const defaultSpawner: Spawner = (exe, args) => spawn(exe, args, { env: subscriptionEnv(), cwd: tmpdir(), windowsHide: true })

export interface TurnResult {
  // structured_output si vino, si no el texto del resultado (que se intenta leer como JSON).
  payload: unknown
  apiMs: number | null
}

interface Pending {
  resolve: (result: TurnResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class ClaudeSession {
  turns = 0
  lastUsed = Date.now()
  // Respondió bien al menos una vez: si muere después, no es culpa del modo sesión.
  answered = false
  private readonly child: ChildProcessWithoutNullStreams
  private stderr = ''
  private pending: Pending | null = null
  private closed = false

  constructor(
    readonly key: string,
    exe: string,
    args: string[],
    spawner: Spawner = defaultSpawner
  ) {
    this.child = spawner(exe, args)
    this.child.stderr.on('data', (d) => (this.stderr = (this.stderr + String(d)).slice(-4000)))
    this.child.stdin.on('error', () => undefined)
    createInterface({ input: this.child.stdout }).on('line', (line) => this.onLine(line))
    this.child.on('error', (err) => {
      this.closed = true
      this.fail(new ClaudeError(`No se pudo ejecutar Claude Code (${err.message}). Revisá que siga instalado.`, 'missing'))
    })
    this.child.on('close', (code) => {
      this.closed = true
      if (this.pending) console.error(`[claude] La sesión terminó con código ${code}`, this.stderr.trim().slice(0, 2000))
      this.fail(explainFailure(this.stderr || `terminó con código ${code}`))
    })
  }

  get alive(): boolean {
    return !this.closed
  }

  get busy(): boolean {
    return this.pending !== null
  }

  send(prompt: string, timeoutMs: number): Promise<TurnResult> {
    if (this.closed) return Promise.reject(new ClaudeError('La sesión de Claude se cerró.', 'unknown'))
    if (this.pending) return Promise.reject(new Error('La sesión de Claude ya está respondiendo otro pedido.'))
    this.turns++
    return new Promise<TurnResult>((resolve, reject) => {
      const timer = setTimeout(() => this.kill(timeoutError(timeoutMs)), timeoutMs)
      this.pending = { resolve, reject, timer }
      this.child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } }) + '\n')
    })
  }

  // Cierra el proceso; si había un pedido en curso, falla con el motivo dado.
  kill(reason: Error = new ClaudeError(CANCELLED_MESSAGE, 'cancelled')): void {
    this.fail(reason)
    if (!this.closed) {
      this.closed = true
      this.child.stdin.end()
      this.child.kill()
    }
  }

  private onLine(line: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      return
    }
    if (event.type !== 'result' || !this.pending) return
    const { resolve, reject, timer } = this.pending
    this.pending = null
    clearTimeout(timer)
    this.lastUsed = Date.now()
    const subtype = typeof event.subtype === 'string' ? event.subtype : 'success'
    if (event.is_error === true || subtype !== 'success') {
      const detail = String(event.result ?? event.errors ?? subtype)
      console.error('[claude] La sesión devolvió un error', detail.slice(0, 2000))
      // Si no logró armar la respuesta con el esquema, es un problema de formato: vale reintentar.
      reject(/structured|schema|json/i.test(subtype) ? new ClaudeError('Claude no respetó el formato pedido.', 'format') : explainFailure(detail))
      return
    }
    this.answered = true
    resolve({
      payload: event.structured_output ?? event.result,
      apiMs: typeof event.duration_api_ms === 'number' ? event.duration_api_ms : null
    })
  }

  private fail(error: Error): void {
    if (!this.pending) return
    const { reject, timer } = this.pending
    this.pending = null
    clearTimeout(timer)
    reject(error)
  }
}
