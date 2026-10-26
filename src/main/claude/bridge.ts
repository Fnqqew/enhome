// Puente con Claude Code: la app usa el Claude Code instalado en la máquina,
// con la sesión (suscripción) del usuario. Nunca usa una clave de API.
//
// Cada pedido pasa por una cola con prioridades (lo que el alumno espera va primero) y se responde
// en una sesión de Claude Code que queda abierta para el próximo pedido del mismo tipo.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import type { ClaudeStatus } from '../../shared/ipc'
import { findClaudeExecutable, oneShotArgs, sessionArgs, subscriptionEnv, type CallSpec, type Effort } from './cli'
import { CANCELLED_MESSAGE, ClaudeError, explainFailure, shouldRetry, timeoutError } from './errors'
import { SessionPool } from './pool'
import { JobQueue, type Priority, type Ticket } from './queue'
import { ClaudeSession } from './session'

export { CANCELLED_MESSAGE, ClaudeError, explainFailure, isCancelled, shouldRetry, type ClaudeErrorKind } from './errors'
export { findClaudeExecutable } from './cli'
export type { Priority, Ticket } from './queue'

const DEFAULT_TIMEOUT_MS = 120_000

// Hasta tres pedidos a la vez; lo de fondo, de a uno.
const queue = new JobQueue(3, 1)
const pool = new SessionPool()
// Sesiones con un pedido en curso, para poder cortarlas al cancelar.
const busySessions = new Set<ClaudeSession>()
// Procesos sueltos en curso (estado de la sesión y plan B), para poder cortarlos al cancelar.
const running = new Set<() => void>()
let cancelEpoch = 0
// Si las sesiones abiertas no funcionan en esta compu, se vuelve a un proceso por pedido.
let sessionsBroken = !!process.env.ENHOME_CLAUDE_SIN_SESIONES

setInterval(() => pool.sweep(), 60_000).unref()

// Corta todo lo que se le está pidiendo a Claude y lo que espera turno.
export function cancelClaude(): number {
  cancelEpoch++
  const count = busySessions.size + running.size + queue.pending
  const cancelled = new ClaudeError(CANCELLED_MESSAGE, 'cancelled')
  queue.rejectWaiting(cancelled)
  for (const session of [...busySessions]) session.kill(cancelled)
  for (const cancel of [...running]) cancel()
  return count
}

// Al cerrar la app no quedan procesos de Claude abiertos.
export function shutdownClaude(): void {
  cancelClaude()
  pool.killAll()
}

// Las pruebas de interfaz usan un Claude simulado: figura conectado, pero cada pedido falla
// (así no gastan la suscripción y de paso se prueban los avisos de error).
const fakeClaude = (): boolean => !!process.env.ENHOME_CLAUDE_FALSO

interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

function runProcess(exe: string, args: string[], input: string, timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { env: subscriptionEnv(), cwd: tmpdir(), windowsHide: true })
    let stdout = ''
    let stderr = ''
    let settled = false
    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      running.delete(cancel)
      finish()
    }
    const cancel = (): void => {
      child.kill()
      settle(() => reject(new ClaudeError(CANCELLED_MESSAGE, 'cancelled')))
    }
    running.add(cancel)
    const timer = setTimeout(() => {
      child.kill()
      settle(() => reject(timeoutError(timeoutMs)))
    }, timeoutMs)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      console.error('[claude] No se pudo ejecutar Claude Code', err)
      settle(() => reject(new ClaudeError(`No se pudo ejecutar Claude Code (${err.message}). Revisá que siga instalado.`, 'missing')))
    })
    child.on('close', (code) => settle(() => resolve({ code, stdout, stderr })))
    child.stdin.end(input)
  })
}

const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  email: z.string().optional(),
  subscriptionType: z.string().nullable().optional()
})

export async function getClaudeStatus(): Promise<ClaudeStatus> {
  if (fakeClaude()) return { state: 'ready', subscription: 'pruebas', email: null }
  const exe = findClaudeExecutable()
  if (!exe) return { state: 'not-installed' }
  try {
    const { stdout } = await runProcess(exe, ['auth', 'status', '--json'], '', 20_000)
    const auth = authStatusSchema.parse(JSON.parse(stdout))
    if (!auth.loggedIn) return { state: 'logged-out' }
    if (auth.authMethod !== 'claude.ai') return { state: 'no-subscription', authMethod: auth.authMethod ?? 'desconocido' }
    return { state: 'ready', subscription: auth.subscriptionType ?? null, email: auth.email ?? null }
  } catch (err) {
    return { state: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

const resultSchema = z.object({
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional()
})

// Claude Code ignora en silencio un --json-schema que incluye "$schema"
// (responde texto libre), así que se quita esa clave.
export function toClaudeJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>
  return jsonSchema
}

export interface AskOptions<T> {
  // Qué se le pide (práctica, corrección…), para medir los tiempos de cada tarea.
  label?: string
  prompt: string
  systemPrompt: string
  schema: z.ZodType<T>
  model?: string
  // Cuánto razona Claude antes de responder: menos esfuerzo es más rápido.
  effort?: Effort
  timeoutMs?: number
  retries?: number
  // 'background' espera a que no haya nada urgente y ocupa un solo lugar.
  priority?: Priority
  // Para poder subir la prioridad de un pedido ya encolado (se usa en vez de priority).
  ticket?: Ticket
  // Las respuestas que no cambian (traducir una palabra) se guardan en memoria y se reusan.
  cache?: boolean
}

// Firma de askClaude, para poder reemplazarla en los tests.
export type Ask = <T>(options: AskOptions<T>) => Promise<T>

// Cuánto tardó cada pedido, contando los reintentos, para ver en Acerca de si empeora y por qué.
export interface ClaudeTiming {
  label: string
  model: string
  effort: string | null
  ms: number
  attempts: number
  ok: boolean
}

let recordTiming: (timing: ClaudeTiming) => void = () => {}

// Ajustes → Claude: rápido piensa menos antes de responder; preciso, más.
export type ClaudeProfile = 'rapido' | 'equilibrado' | 'preciso'
let profile: ClaudeProfile = 'equilibrado'

export function setClaudeProfile(value: ClaudeProfile): void {
  profile = value
}

export function effortFor(requested: Effort | undefined): Effort | undefined {
  if (profile === 'rapido') return 'low'
  if (profile === 'preciso') return 'high'
  return requested
}

export function onClaudeTiming(record: (timing: ClaudeTiming) => void): void {
  recordTiming = record
}

// La sesión acumula los pedidos en una conversación: se le aclara que cada uno es nuevo.
const INDEPENDENT = '\n\nCada mensaje que recibís es un pedido nuevo e independiente de los anteriores de esta conversación.'

function buildSpec(options: Pick<AskOptions<unknown>, 'model' | 'effort' | 'systemPrompt' | 'schema'>): CallSpec {
  return {
    model: options.model ?? 'sonnet',
    effort: effortFor(options.effort),
    systemPrompt: options.systemPrompt + INDEPENDENT,
    jsonSchema: JSON.stringify(toClaudeJsonSchema(options.schema))
  }
}

const hash = (...parts: (string | undefined)[]): string =>
  createHash('sha1')
    .update(parts.map((p) => p ?? '').join('\u0000'))
    .digest('hex')

const specKey = (spec: CallSpec): string => hash(spec.model, spec.effort, spec.systemPrompt, spec.jsonSchema)

// Respuestas guardadas para los pedidos marcados con cache (las más viejas se descartan).
const cache = new Map<string, unknown>()
const CACHE_SIZE = 200

function remember(key: string, value: unknown): void {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string)
}

// Lo que vino como texto se intenta leer como JSON (a veces llega envuelto en ```json).
function readPayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload
  const text = payload
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
  return JSON.parse(text)
}

async function oneShot(exe: string, spec: CallSpec, prompt: string, timeoutMs: number, label: string): Promise<unknown> {
  const { code, stdout, stderr } = await runProcess(exe, oneShotArgs(spec), prompt, timeoutMs)
  if (code !== 0) {
    console.error(`[claude] ${label}: terminó con código ${code}`, stderr.trim() || stdout.trim().slice(0, 2000))
    throw explainFailure(`${stderr}\n${stdout}`)
  }
  const envelope = resultSchema.parse(JSON.parse(stdout))
  if (envelope.is_error) {
    console.error(`[claude] ${label}: devolvió un error`, envelope.result)
    throw explainFailure(envelope.result ?? '')
  }
  return envelope.structured_output ?? envelope.result
}

async function inSession(exe: string, spec: CallSpec, prompt: string, timeoutMs: number): Promise<unknown> {
  const key = specKey(spec)
  const session = pool.take(key) ?? new ClaudeSession(key, exe, sessionArgs(spec))
  busySessions.add(session)
  try {
    const { payload } = await session.send(prompt, timeoutMs)
    pool.give(session)
    return payload
  } catch (err) {
    session.kill(err instanceof Error ? err : undefined)
    // Una sesión que muere sin haber respondido nunca y sin explicar por qué: se usa el plan B.
    if (!session.answered && err instanceof ClaudeError && err.kind === 'unknown') {
      console.error('[claude] Las sesiones abiertas no funcionan; se vuelve a un proceso por pedido.')
      sessionsBroken = true
    }
    throw err
  } finally {
    busySessions.delete(session)
  }
}

function run(exe: string, spec: CallSpec, prompt: string, timeoutMs: number, label: string): Promise<unknown> {
  return sessionsBroken ? oneShot(exe, spec, prompt, timeoutMs, label) : inSession(exe, spec, prompt, timeoutMs)
}

// Pide a Claude una respuesta estructurada y la valida. Reintenta si el formato no coincide.
export async function askClaude<T>(options: AskOptions<T>): Promise<T> {
  const { label = 'otro', prompt, schema, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2 } = options
  if (fakeClaude()) throw new ClaudeError('Claude simulado: en las pruebas de interfaz no responde.', 'offline')
  const exe = findClaudeExecutable()
  if (!exe) throw new ClaudeError('Claude Code no está instalado.', 'missing')
  const spec = buildSpec(options)
  const cacheKey = options.cache ? hash(specKey(spec), prompt) : null
  if (cacheKey && cache.has(cacheKey)) return schema.parse(cache.get(cacheKey))

  const ticket = options.ticket ?? { priority: options.priority ?? 'now' }
  const epoch = cancelEpoch
  const started = Date.now()
  const finish = (attempts: number, ok: boolean): void => {
    try {
      recordTiming({ label, model: spec.model, effort: spec.effort ?? null, ms: Date.now() - started, attempts, ok })
    } catch (error) {
      console.error('No se pudo guardar el tiempo de Claude', error)
    }
  }

  let lastError: unknown
  // La última respuesta que no respetó el esquema, para ver en el registro qué mandó Claude.
  let lastInvalid: unknown
  let attempts = 0
  for (let attempt = 0; attempt <= retries; attempt++) {
    attempts = attempt + 1
    try {
      const payload = await queue.run(ticket, () => {
        // Un pedido que esperaba turno cuando se canceló no llega a arrancar.
        if (cancelEpoch !== epoch) throw new ClaudeError(CANCELLED_MESSAGE, 'cancelled')
        return run(exe, spec, prompt, timeoutMs, label)
      })
      const raw = readPayload(payload)
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        lastInvalid = raw
        throw parsed.error
      }
      if (cacheKey) remember(cacheKey, parsed.data)
      finish(attempts, true)
      return parsed.data
    } catch (err) {
      lastError = err
      if (!shouldRetry(err)) break
    }
  }
  finish(attempts, false)
  if (lastError instanceof ClaudeError) throw lastError
  console.error(`[claude] ${label}: respuesta con formato inválido`, lastError)
  if (lastInvalid !== undefined) console.error(`[claude] ${label}: lo que respondió`, JSON.stringify(lastInvalid).slice(0, 4000))
  throw new ClaudeError(
    'Claude respondió con un formato inesperado varias veces seguidas. Reintentá: suele salir bien en el intento siguiente.',
    'format'
  )
}

// Abre de antemano una sesión para un tipo de pedido que está por llegar (por ejemplo, la corrección
// apenas empieza una práctica), así el primer pedido no paga el arranque. Va en segundo plano.
export function prewarmClaude(options: Pick<AskOptions<unknown>, 'model' | 'effort' | 'systemPrompt' | 'schema'>): void {
  if (fakeClaude() || sessionsBroken) return
  const exe = findClaudeExecutable()
  if (!exe) return
  const spec = buildSpec(options)
  const key = specKey(spec)
  if (pool.has(key)) return
  void queue
    .run({ priority: 'background' }, async () => {
      if (pool.has(key)) return
      const session = new ClaudeSession(key, exe, sessionArgs(spec))
      busySessions.add(session)
      try {
        await session.send('Prueba de conexión: respondé con el ejemplo más corto posible que cumpla el formato.', 60_000)
        pool.give(session)
      } finally {
        busySessions.delete(session)
      }
    })
    .catch(() => undefined)
}

// Para un pedido de fondo que pasó a ser urgente: lo pone primero en la cola.
export function promote(ticket: Ticket): void {
  if (ticket.priority === 'now') return
  ticket.priority = 'now'
  queue.reschedule()
}
