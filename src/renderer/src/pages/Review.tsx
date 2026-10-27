import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth, weekdayName } from '@shared/dates'
import { REVIEW_STEPS, type ReviewItemView, type ReviewOverview } from '@shared/review'
import Icon from '../components/Icon'
import ReviewPlayer from '../components/review/ReviewPlayer'
import VocabCards from '../components/review/VocabCards'
import CoreWords from '../components/review/CoreWords'
import { announceRewards } from '../rewardsBus'
import type { Navigate } from '../navigation'
import { SkeletonCard } from '../components/Skeleton'

// Repaso: el cuaderno de errores. Lo que se respondió mal vuelve a los 1, 3, 7 y 15 días hasta acertarlo
// cuatro veces seguidas. Desde el resultado de un examen se abre con exactamente las preguntas falladas.
export default function Review({ examId, navigate }: { examId: number | null; navigate: Navigate }): React.JSX.Element {
  const [overview, setOverview] = useState<ReviewOverview | null>(null)
  const [items, setItems] = useState<ReviewItemView[] | null>(null)
  const [playing, setPlaying] = useState(examId !== null)
  const [error, setError] = useState<string | null>(null)
  // Al sumar palabras del día, la lista de tarjetas se vuelve a cargar.
  const [vocabKey, setVocabKey] = useState(0)

  const load = useCallback(() => {
    setError(null)
    Promise.all([window.api.getReviewOverview(), examId !== null ? window.api.getExamReview(examId) : window.api.getDueReviews()])
      .then(([o, list]) => {
        setOverview(o)
        setItems(list)
      })
      .catch((err: Error) => setError(err.message))
  }, [examId])

  useEffect(load, [load])

  if (error) {
    return (
      <>
        <h1>Repaso</h1>
        <section className="card stack">
          <p className="error multiline">{error}</p>
          <div>
            <button className="btn secondary" onClick={load}>
              Reintentar
            </button>
          </div>
        </section>
      </>
    )
  }
  if (!overview || !items) {
    return (
      <>
        <h1>Repaso</h1>
        <SkeletonCard lines={4} />
      </>
    )
  }

  if (playing && items.length > 0) {
    return (
      <>
        <h1>{examId !== null ? 'Repaso del examen' : 'Repaso'}</h1>
        <ReviewPlayer
          items={items}
          title={examId !== null ? 'Lo que fallaste en el examen' : 'Repaso del día'}
          onDone={() => {
            setPlaying(false)
            announceRewards()
            if (examId !== null) navigate('repaso')
            else load()
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1>Repaso</h1>
      <section className="card stack fade-in">
        <div className="card-header">
          <div>
            <span className="level">CUADERNO DE ERRORES</span>
            <h2>{overview.dueToday > 0 ? `Tenés ${overview.dueToday} para repasar hoy` : 'Nada para repasar hoy'}</h2>
          </div>
          <Icon name="repaso" className="hero-icon" />
        </div>
        <p className="muted">
          Cada respuesta incorrecta de la práctica o de un examen se anota acá y vuelve justo antes de que la olvides: pronto mientras te cuesta y
          cada vez más espaciada cuando la acertás. Cuando la memoria llega a {REVIEW_STEPS - 1} de {REVIEW_STEPS - 1}, queda aprendida.
        </p>
        <div className="review-stats">
          <Stat value={overview.dueToday} label="para hoy" />
          <Stat value={overview.pending} label="pendientes" />
          <Stat value={overview.learned} label="aprendidos" />
        </div>
        {items.length > 0 ? (
          <div className="row">
            <button className="btn" onClick={() => setPlaying(true)}>
              Empezar repaso ({items.length})
            </button>
          </div>
        ) : overview.pending === 0 ? (
          <p className="muted small">Cuando te equivoques en una práctica o en un examen, ese ejercicio va a aparecer acá para repasarlo.</p>
        ) : null}
      </section>

      <CoreWords onLearned={() => setVocabKey((k) => k + 1)} />
      <VocabCards key={vocabKey} />

      {overview.pending > 0 && (
        <section className="card stack fade-in">
          <h2>Próximos días</h2>
          <div className="review-upcoming" role="list">
            {overview.upcoming.map((day) => (
              <div
                key={day.date}
                className="review-upcoming-day"
                role="listitem"
                aria-label={`${weekdayName(day.date)} ${formatDayMonth(day.date)}: ${day.count}`}
              >
                <span className="review-upcoming-bar" style={{ height: `${Math.min(100, day.count * 18 + (day.count > 0 ? 10 : 0))}%` }} />
                <span className="review-upcoming-count">{day.count || ''}</span>
                <span className="muted small">{weekdayName(day.date).slice(0, 3)}</span>
              </div>
            ))}
          </div>
          {overview.byTopic.length > 0 && (
            <ul className="topic-counts">
              {overview.byTopic.map((t) => (
                <li key={t.topicId}>
                  <span>{t.topicTitle}</span>
                  <span className="badge">{t.pending}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function Stat({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <div className="review-stat">
      <strong>{value}</strong>
      <span className="muted small">{label}</span>
    </div>
  )
}
