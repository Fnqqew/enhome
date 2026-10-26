// Errores de Claude: qué salió mal, cómo explicarlo y si vale la pena reintentar.

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
    pattern:
      /enotfound|econnrefused|econnreset|etimedout|eai_again|getaddrinfo|network|fetch failed|connection (error|refused)|socket hang up|unable to connect/i,
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

export function isCancelled(err: unknown): boolean {
  return err instanceof ClaudeError && err.kind === 'cancelled'
}

export function timeoutError(ms: number): ClaudeError {
  return new ClaudeError(`Claude tardó más de ${duration(ms)} en responder. Suele pasar cuando está saturado: reintentá en un rato.`, 'timeout')
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return `${Math.round(ms / 1000)} segundos`
  return minutes === 1 ? 'un minuto' : `${minutes} minutos`
}
