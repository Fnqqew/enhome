import { useEffect, useState } from 'react'
import type { RewardNews } from '@shared/rewards'

const POLL_MS = 15_000
const VISIBLE_MS = 6_000
const MAX_VISIBLE = 4

// Carteles de logros, niveles y comodines. Se consultan periódicamente y al cambiar de sección.
export default function RewardToasts({ trigger }: { trigger: string }): React.JSX.Element {
  const [toasts, setToasts] = useState<RewardNews[]>([])

  useEffect(() => {
    const poll = (): void => {
      window.api
        .takeRewardNews()
        .then((news) => {
          if (news.length > 0) setToasts((current) => [...current, ...news].slice(-MAX_VISIBLE))
        })
        .catch(() => undefined)
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => clearInterval(timer)
  }, [trigger])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => setToasts((current) => current.slice(1)), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [toasts])

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast ${toast.kind}`}
          title="Cerrar"
          onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
