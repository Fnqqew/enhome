import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth } from '@shared/dates'
import type { VocabCard, VocabOverview } from '@shared/vocab'
import { useSpeech } from '../../hooks/useSpeech'
import Icon from '../Icon'
import { SkeletonCard } from '../Skeleton'

// Vocabulario guardado: tarjetas para repasar (de la palabra a la traducción) y la lista completa.
export default function VocabCards(): React.JSX.Element {
  const [overview, setOverview] = useState<VocabOverview | null>(null)
  const [due, setDue] = useState<VocabCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(() => {
    window.api
      .getVocab()
      .then(setOverview)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  if (error) return <p className="error">{error}</p>
  if (!overview) return <SkeletonCard lines={3} />

  if (due) {
    return (
      <Flashcards
        cards={due}
        onDone={() => {
          setDue(null)
          load()
        }}
      />
    )
  }

  const count = overview.cards.length
  const visible = showAll ? overview.cards : overview.cards.slice(0, 8)
  const heading =
    count === 0
      ? 'Todavía no guardaste palabras'
      : overview.dueToday > 0
        ? `${overview.dueToday} ${overview.dueToday === 1 ? 'tarjeta' : 'tarjetas'} para hoy`
        : `${count} ${count === 1 ? 'palabra guardada' : 'palabras guardadas'}`

  return (
    <section className="card stack fade-in">
      <div>
        <span className="level">VOCABULARIO</span>
        <h2>{heading}</h2>
      </div>
      <p className="muted small">
        Seleccioná (o tocá dos veces) una palabra en un resumen, una lectura o un ejercicio corregido y elegí «Traducir»: desde ahí la guardás. Vuelve
        en tarjetas a los 1, 3, 7, 15 y 30 días, y también aparece en los juegos.
      </p>
      {overview.dueToday > 0 && (
        <div>
          <button
            className="btn"
            onClick={() =>
              window.api
                .getDueWords()
                .then(setDue)
                .catch((err: Error) => setError(err.message))
            }
          >
            Repasar tarjetas ({overview.dueToday})
          </button>
        </div>
      )}
      {count > 0 && (
        <ul className="vocab-list">
          {visible.map((card) => (
            <li key={card.id}>
              <div>
                <strong className="en">{card.term}</strong> <span className="muted">— {card.translation}</span>
                {card.note && <p className="muted small">{card.note}</p>}
              </div>
              <span className="muted small">vuelve el {formatDayMonth(card.dueOn)}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Borrar «${card.term}»`}
                title="Borrar"
                onClick={() =>
                  window.api
                    .removeWord(card.id)
                    .then(setOverview)
                    .catch((err: Error) => setError(err.message))
                }
              >
                <Icon name="cross" className="glyph" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {count > 8 && (
        <div>
          <button className="btn secondary" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Ver menos' : `Ver las ${count}`}
          </button>
        </div>
      )}
    </section>
  )
}

// La oración de ejemplo con la frase hecha tapada (null si la frase no aparece tal cual en el ejemplo).
function cloze(card: VocabCard): string | null {
  const at = card.example.toLowerCase().indexOf(card.term.toLowerCase())
  if (at < 0) return null
  return `${card.example.slice(0, at)}_____${card.example.slice(at + card.term.length)}`
}

function Flashcards({ cards, onDone }: { cards: VocabCard[]; onDone: () => void }): React.JSX.Element {
  const speech = useSpeech()
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const card = cards[index]

  const answer = (knew: boolean): void => {
    window.api.reviewWord(card.id, knew).catch(() => undefined)
    if (knew) setKnown((n) => n + 1)
    setIndex(index + 1)
    setFlipped(false)
  }

  if (index >= cards.length) {
    return (
      <section className="card stack fade-in">
        <span className="level">VOCABULARIO</span>
        <h2>
          Te sabías {known} de {cards.length}
        </h2>
        <p className="muted">Las que no te sabías vuelven mañana.</p>
        <div>
          <button className="btn" onClick={onDone}>
            Listo
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card stack">
      <div className="card-header">
        <span className="level">TARJETAS</span>
        <span className="muted">
          {index + 1} / {cards.length}
        </span>
      </div>
      <button type="button" className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(true)} aria-live="polite">
        {!flipped && card.kind === 'phrase' && cloze(card) ? (
          <>
            <span className="flashcard-term en">{cloze(card)}</span>
            <span className="muted small">Completá la frase hecha: «{card.translation}». Decila entera y tocá para ver si era.</span>
          </>
        ) : !flipped ? (
          <>
            <span className="flashcard-term en">{card.term}</span>
            <span className="muted small">Tocá para ver la traducción</span>
          </>
        ) : card.kind === 'phrase' ? (
          <>
            <span className="flashcard-term en">{card.term}</span>
            <span className="small">
              <span className="en">{card.example}</span>
              <br />
              <span className="muted">{card.exampleEs}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flashcard-term">{card.translation}</span>
            <span className="small">
              <span className="en">{card.example}</span>
              <br />
              <span className="muted">{card.exampleEs}</span>
            </span>
          </>
        )}
      </button>
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(card.kind === 'phrase' && flipped ? card.example : card.term)}>
          <Icon name="play" className="glyph" /> Escuchar
        </button>
        {flipped && (
          <>
            <button className="btn" onClick={() => answer(true)}>
              Me la sabía
            </button>
            <button className="btn secondary" onClick={() => answer(false)}>
              No me la sabía
            </button>
          </>
        )}
      </div>
    </section>
  )
}
