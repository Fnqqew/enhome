// Cómo se lanza Claude Code: dónde está, con qué entorno y con qué opciones.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

export type Effort = 'low' | 'medium' | 'high'

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
export function subscriptionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.CLAUDECODE
  return env
}

// La app no usa los conectores, plugins ni skills del usuario. Cargarlos sumaba unos 32.000 tokens
// a cada pedido; sin ellos son unos 650 (medido el 2026-10-26).
export const ISOLATION_ARGS = ['--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', 'project']

export interface CallSpec {
  model: string
  effort?: Effort
  systemPrompt: string
  // Esquema JSON ya serializado (sin "$schema").
  jsonSchema: string
}

// Opciones comunes a todo pedido: sin herramientas, sin guardar la sesión y aislado de la configuración del usuario.
// prettier-ignore
export function specArgs(spec: CallSpec): string[] {
  return [
    '--tools', '',
    '--no-session-persistence',
    ...ISOLATION_ARGS,
    '--model', spec.model,
    ...(spec.effort ? ['--effort', spec.effort] : []),
    '--system-prompt', spec.systemPrompt,
    '--json-schema', spec.jsonSchema
  ]
}

// Un pedido suelto: arranca, responde y termina.
export function oneShotArgs(spec: CallSpec): string[] {
  return ['-p', '--output-format', 'json', ...specArgs(spec)]
}

// Una sesión que queda abierta y recibe pedidos por stdin, uno por línea.
export function sessionArgs(spec: CallSpec): string[] {
  return ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', ...specArgs(spec)]
}
