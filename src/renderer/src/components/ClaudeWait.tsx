import { useEffect, useState } from 'react'

// Pasado un minuto esperando a Claude, avisa y ofrece cortar el pedido: la promesa que
// esperaba falla con «Cancelaste el pedido a Claude» y la pantalla muestra Reintentar.
const SLOW_AFTER_MS = 60_000

export default function ClaudeWait({ active }: { active: boolean }): React.JSX.Element | null {
  const [slow, setSlow] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    setSlow(false)
    setCancelling(false)
    if (!active) return
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [active])

  if (!active || !slow) return null
  return (
    <div className="notice warn claude-wait" role="status">
      <span>Claude está tardando más de lo normal. Podés seguir esperando o cancelar y reintentar en un rato.</span>
      <button
        className="btn secondary"
        disabled={cancelling}
        onClick={() => {
          setCancelling(true)
          window.api.cancelClaude().catch(() => setCancelling(false))
        }}
      >
        {cancelling ? 'Cancelando…' : 'Cancelar'}
      </button>
    </div>
  )
}
