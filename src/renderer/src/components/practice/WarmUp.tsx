// El calentamiento del día: unos pocos errores del cuaderno antes de la microlección. Recordar lo de
// días anteriores al empezar suelta la mano y fija lo que se está por olvidar.

import { useState } from 'react'
import type { ReviewItemView } from '@shared/review'
import { announceRewards } from '../../rewardsBus'
import ReviewPlayer from '../review/ReviewPlayer'

// Cuántos repasos entran en el calentamiento (el resto queda en Repaso).
export const WARM_UP_SIZE = 5

export default function WarmUp({ due, onDone }: { due: number; onDone: () => void }): React.JSX.Element {
  const [items, setItems] = useState<ReviewItemView[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const count = Math.min(due, WARM_UP_SIZE)

  if (items && items.length > 0) {
    return (
      <ReviewPlayer
        items={items}
        title="Calentamiento"
        onDone={() => {
          announceRewards()
          onDone()
        }}
      />
    )
  }

  const start = (): void => {
    setLoading(true)
    setError(null)
    window.api
      .getDueReviews()
      .then((list) => {
        if (list.length === 0) onDone()
        else setItems(list.slice(0, WARM_UP_SIZE))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  return (
    <section className="card stack fade-in">
      <span className="level">CALENTAMIENTO</span>
      <h2>{count === 1 ? 'Antes de empezar, un repaso' : `Antes de empezar, ${count} repasos`}</h2>
      <p className="muted">
        Son errores de días anteriores que están por olvidarse. Recordarlos ahora los fija y te deja con la cabeza en el idioma para la microlección.
        Te lleva un par de minutos.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" disabled={loading} onClick={start}>
          {loading ? 'Cargando…' : 'Empezar el calentamiento'}
        </button>
        <button className="btn secondary" disabled={loading} onClick={onDone}>
          Saltarlo hoy
        </button>
      </div>
    </section>
  )
}
