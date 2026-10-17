import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth, weekdayName } from '@shared/dates'
import { EXERCISE_TYPE_LABELS, type ExerciseAnswer } from '@shared/exercises'
import { REVIEW_INTERVALS, REVIEW_STEPS, type ReviewAnswerResult, type ReviewItemView, type ReviewOverview } from '@shared/review'
import ClaudeWait from '../components/ClaudeWait'
import Icon from '../components/Icon'
import ExerciseInput from '../components/practice/ExerciseInput'
import VocabCards from '../components/review/VocabCards'
import Feedback from '../components/practice/Feedback'
import { announceRewards } from '../rewardsBus'
import { play } from '../sounds'
import type { Navigate } from '../navigation'
import { SkeletonCard } from '../components/Skeleton'

// Repaso: el cuaderno de errores. Lo que se respondió mal vuelve a los 1, 3, 7 y 15 días hasta acertarlo
// cuatro veces seguidas. Desde el resultado de un examen se abre con exactamente las preguntas falladas.
export default function Review({ examId, navigate }: { examId: number | null; navigate: Navigate }): React.JSX.Element {
  const [overview, setOverview] = useState<ReviewOverview | null>(null)
  const [items, setItems] = useState<ReviewItemView[] | null>(null)
  const [playing, setPlaying] = useState(examId !== null)
  const [error, setError] = useState<string | null>(null)

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
          Cada respuesta incorrecta de la práctica o de un examen se anota acá y vuelve a los {REVIEW_INTERVALS.join(', ')} días. Cuando la acertás{' '}
          {REVIEW_STEPS} veces seguidas, queda aprendida.
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

      <VocabCards />

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

function ReviewPlayer({ items, title, onDone }: { items: ReviewItemView[]; title: string; onDone: () => void }): React.JSX.Element {
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<ExerciseAnswer | null>(null)
  const [result, setResult] = useState<ReviewAnswerResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [right, setRight] = useState(0)

  const item = items[index]
  const finished = index >= items.length

  const check = (event: React.FormEvent): void => {
    event.preventDefault()
    if (!draft || busy || result) return
    setBusy(true)
    setError(null)
    window.api
      .answerReview(item.id, draft)
      .then((r) => {
        setResult(r)
        play(r.feedback.correct ? 'correct' : 'wrong')
        if (r.feedback.correct) setRight((n) => n + 1)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false))
  }

  const next = (): void => {
    setIndex((i) => i + 1)
    setDraft(null)
    setResult(null)
  }

  if (finished) {
    return (
      <section className="card stack fade-in">
        <span className="level">{title.toUpperCase()}</span>
        <h2>
          Acertaste {right} de {items.length}
        </h2>
        <p className="muted">Lo que fallaste vuelve mañana; lo que acertaste, más adelante. Así se fija de verdad.</p>
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
        <div>
          <span className="level">
            {title.toUpperCase()} · {item.topicTitle.toUpperCase()}
          </span>
          <h2>{item.subtopicTitle || item.topicTitle}</h2>
        </div>
        <span className="muted">
          {index + 1} / {items.length}
        </span>
      </div>
      <form className="stack" onSubmit={check}>
        <div className="row">
          <span className="exercise-type">{EXERCISE_TYPE_LABELS[item.type]}</span>
          <span className="muted small">
            {item.source === 'exam' ? 'De un examen' : 'De una práctica'} · repaso {item.stage + 1} de {REVIEW_STEPS}
          </span>
        </div>
        <p>{item.content.instruction}</p>
        <ExerciseInput key={item.id} content={item.content} answer={null} feedback={result?.feedback ?? null} onChange={setDraft} />
        {result && <Feedback type={item.type} feedback={result.feedback} />}
        {result && (
          <p className={result.feedback.correct ? 'review-next ok' : 'review-next'}>
            {result.learned
              ? '¡Aprendido! Ya no vuelve.'
              : result.feedback.correct
                ? `Bien: vuelve el ${weekdayName(result.nextDue!)} ${formatDayMonth(result.nextDue!)}.`
                : 'Vuelve mañana para que lo practiques de nuevo.'}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <ClaudeWait active={busy} />
        <div className="row">
          {result ? (
            <button className="btn" type="button" onClick={next}>
              {index + 1 < items.length ? 'Siguiente' : 'Ver resultado'}
            </button>
          ) : (
            <>
              <button className="btn" type="submit" disabled={!draft || busy}>
                {busy ? 'Corrigiendo…' : 'Comprobar'}
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={next}>
                Saltar
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  )
}
