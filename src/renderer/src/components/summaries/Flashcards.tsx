import { useEffect, useState } from 'react'
import type { Flashcard } from '@shared/summaries'

function shuffledIndexes(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export default function Flashcards({ cards }: { cards: Flashcard[] }): React.JSX.Element {
  const [order, setOrder] = useState(() => cards.map((_, i) => i))
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    setOrder(cards.map((_, i) => i))
    setPosition(0)
    setFlipped(false)
  }, [cards])

  const go = (delta: number): void => {
    setPosition((p) => (p + delta + cards.length) % cards.length)
    setFlipped(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const card = cards[order[position]]
  if (!card) return <p className="muted">No hay tarjetas.</p>

  return (
    <div className="stack flashcards">
      <button
        type="button"
        className={`flashcard${flipped ? ' flipped' : ''}`}
        aria-label={flipped ? 'Ver la pregunta' : 'Ver la respuesta'}
        onClick={() => setFlipped((f) => !f)}
      >
        {!flipped ? (
          <>
            <span className="level">PREGUNTA</span>
            <span className="flash-text">{card.front}</span>
            <span className="muted small">Tocá la tarjeta para ver la respuesta</span>
          </>
        ) : (
          <>
            <span className="level">RESPUESTA</span>
            <span className="flash-text">{card.back}</span>
            {card.example && <span className="muted">{card.example}</span>}
          </>
        )}
      </button>
      <div className="row spread">
        <button type="button" className="btn secondary" onClick={() => go(-1)}>
          ← Anterior
        </button>
        <span className="muted">
          {position + 1} de {cards.length}
        </span>
        <button type="button" className="btn secondary" onClick={() => go(1)}>
          Siguiente →
        </button>
      </div>
      <div>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setOrder(shuffledIndexes(cards.length))
            setPosition(0)
            setFlipped(false)
          }}
        >
          Mezclar tarjetas
        </button>
      </div>
    </div>
  )
}
