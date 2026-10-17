// Puente con Claude Code: la app usa el Claude Code instalado en la máquina,
// con la sesión (suscripción) del usuario. Nunca usa una clave de API.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { z } from 'zod'
import type { ClaudeStatus } from '../../shared/ipc'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_CONCURRENT_CALLS = 2

// Qué salió mal, para explicarlo y decidir si vale la pena reintentar.
export type ClaudeErrorKind = 'missing' | 'timeout' | 'offline' | 'auth' | 'limit' | 'overloaded' | 'format' | 'cancelled' | 'unknown'

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly kind: ClaudeErrorKind = 'unknown'
  ) {
    super(message)
  }
}

// Reintentar solo sirve si la respuesta vino mal armada o el error no se pudo identificar:
// sin conexión, sin sesión, sin cupo, cancelado o colgado, reintentar solo hace esperar más.
export function shouldRetry(err: unknown): boolean {
  return !(err instanceof ClaudeError) || err.kind === 'format' || err.kind === 'unknown'
}

const FAILURES: { kind: ClaudeErrorKind; pattern: RegExp; message: string }[] = [
  {
    kind: 'auth',
    pattern: /not logged in|run \/login|invalid api key|oauth|token (has )?expired|unauthori[sz]ed|authentication|\b401\b/i,
    message: 'Tu sesión de Claude Code venció. Abrí una terminal, ejecutá «claude», iniciá sesión de nuevo y después tocá Reintentar.'
  },
  {
    kind: 'limit',
    pattern: /usage limit|rate limit|limit reached|quota|\b429\b/i,
    message: 'Llegaste al límite de uso de tu plan de Claude por ahora. Claude Code avisa a qué hora se renueva; volvé a intentar después.'
  },
  {
    kind: 'overloaded',
    pattern: /overloaded|\b529\b|\b50[023]\b|internal server error|api error/i,
    message: 'Los servidores de Claude están saturados en este momento. Esperá un minuto y reintentá.'
  },
  {
    kind: 'offline',
    pattern: /enotfound|econnrefused|econnreset|etimedout|eai_again|getaddrinfo|network|fetch failed|connection (error|refused)|socket hang up|unable to connect/i,
    message: 'No hay conexión con Claude. Revisá tu internet y reintentá.'
  }
]

// Traduce lo que escribe Claude Code al fallar a algo que se entienda; el texto técnico queda en el registro.
export function explainFailure(output: string): ClaudeError {
  const failure = FAILURES.find((f) => f.pattern.test(output))
  if (failure) return new ClaudeError(failure.message, failure.kind)
  return new ClaudeError('Claude Code falló sin dar más detalles. Reintentá; si se repite, abrí el registro de errores desde Acerca de.')
}

export const CANCELLED_MESSAGE = 'Cancelaste el pedido a Claude.'

// Procesos de Claude en curso, para poder cancelarlos desde la interfaz.
const running = new Set<() => void>()
let cancelEpoch = 0

// Corta todo lo que se le está pidiendo a Claude y lo que espera turno.
export function cancelClaude(): number {
  cancelEpoch++
  const count = running.size
  for (const cancel of [...running]) cancel()
  return count
}

export function isCancelled(err: unknown): boolean {
  return err instanceof ClaudeError && err.kind === 'cancelled'
}

// Limita cuántos procesos de Claude corren a la vez (generar contenido en lote no debe
// lanzar decenas). Al terminar, el lugar pasa directo al siguiente en espera.
let activeCalls = 0
const waiting: (() => void)[] = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeCalls < MAX_CONCURRENT_CALLS) activeCalls++
  else await new Promise<void>((resolve) => waiting.push(resolve))
  try {
    return await fn()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else activeCalls--
  }
}

export function findClaudeExecutable(): string | null {
  const candidates = [
    process.env.CLAUDE_PATH,
    join(homedir(), '.local', 'bin', 'claude.exe'),
    join(homedir(), '.local', 'bin', 'claude'),
    ...(process.env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .flatMap((dir) => [join(dir, 'claude.exe'), join(dir, 'claude')])
  ]
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null
}

// Sin ANTHROPIC_API_KEY se fuerza el uso de la suscripción; sin CLAUDECODE
// no se confunde con una sesión anidada.
function subscriptionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.CLAUDECODE
  return env
}

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
      settle(() => reject(new ClaudeError(`Claude tardó más de ${duration(timeoutMs)} en responder. Suele pasar cuando está saturado: reintentá en un rato.`, 'timeout')))
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

function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return `${Math.round(ms / 1000)} segundos`
  return minutes === 1 ? 'un minuto' : `${minutes} minutos`
}

const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  email: z.string().optional(),
  subscriptionType: z.string().nullable().optional()
})

export async function getClaudeStatus(): Promise<ClaudeStatus> {
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
  effort?: 'low' | 'medium' | 'high'
  timeoutMs?: number
  retries?: number
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

export function effortFor(requested: AskOptions<unknown>['effort']): AskOptions<unknown>['effort'] {
  if (profile === 'rapido') return 'low'
  if (profile === 'preciso') return 'high'
  return requested
}

export function onClaudeTiming(record: (timing: ClaudeTiming) => void): void {
  recordTiming = record
}

// Pide a Claude una respuesta estructurada y la valida. Reintenta si el formato no coincide.
export async function askClaude<T>({
  label = 'otro',
  prompt,
  systemPrompt,
  schema,
  model = 'sonnet',
  effort,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 2
}: AskOptions<T>): Promise<T> {
  const exe = findClaudeExecutable()
  if (!exe) throw new ClaudeError('Claude Code no está instalado.', 'missing')
  const epoch = cancelEpoch

  const args = [
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--no-session-persistence',
    '--model', model,
    ...(effortFor(effort) ? ['--effort', effortFor(effort)!] : []),
    '--system-prompt', systemPrompt,
    '--json-schema', JSON.stringify(toClaudeJsonSchema(schema))
  ]

  const started = Date.now()
  const finish = (attempts: number, ok: boolean): void => {
    try {
      recordTiming({ label, model, effort: effort ?? null, ms: Date.now() - started, attempts, ok })
    } catch (error) {
      console.error('No se pudo guardar el tiempo de Claude', error)
    }
  }

  let lastError: unknown
  let attempts = 0
  for (let attempt = 0; attempt <= retries; attempt++) {
    attempts = attempt + 1
    try {
      const { code, stdout, stderr } = await withSlot(() => {
        // Un pedido que esperaba turno cuando se canceló no llega a arrancar.
        if (cancelEpoch !== epoch) throw new ClaudeError(CANCELLED_MESSAGE, 'cancelled')
        return runProcess(exe, args, prompt, timeoutMs)
      })
      if (code !== 0) {
        console.error(`[claude] ${label}: terminó con código ${code}`, stderr.trim() || stdout.trim().slice(0, 2000))
        throw explainFailure(`${stderr}\n${stdout}`)
      }
      const envelope = resultSchema.parse(JSON.parse(stdout))
      if (envelope.is_error) {
        console.error(`[claude] ${label}: devolvió un error`, envelope.result)
        throw explainFailure(envelope.result ?? '')
      }
      const payload = envelope.structured_output ?? JSON.parse(envelope.result ?? '')
      const result = schema.parse(payload)
      finish(attempts, true)
      return result
    } catch (err) {
      lastError = err
      if (!shouldRetry(err)) break
    }
  }
  finish(attempts, false)
  if (lastError instanceof ClaudeError) throw lastError
  console.error(`[claude] ${label}: respuesta con formato inválido`, lastError)
  throw new ClaudeError('Claude respondió con un formato inesperado varias veces seguidas. Reintentá: suele salir bien en el intento siguiente.', 'format')
}
