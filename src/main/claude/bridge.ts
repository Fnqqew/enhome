// Puente con Claude Code: la app usa el Claude Code instalado en la máquina,
// con la sesión (suscripción) del usuario. Nunca usa una clave de API.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { z } from 'zod'
import type { ClaudeStatus } from '../../shared/ipc'

const DEFAULT_TIMEOUT_MS = 120_000

export class ClaudeError extends Error {}

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
    const timer = setTimeout(() => {
      child.kill()
      reject(new ClaudeError('Claude tardó demasiado en responder.'))
    }, timeoutMs)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new ClaudeError(`No se pudo ejecutar Claude Code: ${err.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
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
  prompt: string
  systemPrompt: string
  schema: z.ZodType<T>
  model?: string
  timeoutMs?: number
  retries?: number
}

// Pide a Claude una respuesta estructurada y la valida. Reintenta si el formato no coincide.
export async function askClaude<T>({
  prompt,
  systemPrompt,
  schema,
  model = 'sonnet',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 2
}: AskOptions<T>): Promise<T> {
  const exe = findClaudeExecutable()
  if (!exe) throw new ClaudeError('Claude Code no está instalado.')

  const args = [
    '-p',
    '--output-format', 'json',
    '--tools', '',
    '--no-session-persistence',
    '--model', model,
    '--system-prompt', systemPrompt,
    '--json-schema', JSON.stringify(toClaudeJsonSchema(schema))
  ]

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { code, stdout, stderr } = await runProcess(exe, args, prompt, timeoutMs)
      if (code !== 0) throw new ClaudeError(stderr.trim() || `Claude Code terminó con código ${code}.`)
      const envelope = resultSchema.parse(JSON.parse(stdout))
      if (envelope.is_error) throw new ClaudeError(envelope.result ?? 'Claude devolvió un error.')
      const payload = envelope.structured_output ?? JSON.parse(envelope.result ?? '')
      return schema.parse(payload)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof ClaudeError
    ? lastError
    : new ClaudeError(`Respuesta inválida de Claude: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
