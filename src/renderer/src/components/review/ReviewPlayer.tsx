// Repasa una lista de errores del cuaderno: en Repaso y como calentamiento antes de la práctica.

import { useState } from 'react'
import { formatDayMonth, weekdayName } from '@shared/dates'
import { EXERCISE_TYPE_LABELS, type ExerciseAnswer } from '@shared/exercises'
import { REVIEW_STEPS, type ReviewAnswerResult, type ReviewItemView } from '@shared/review'
import ClaudeWait from '../ClaudeWait'
import ExerciseInput from '../practice/ExerciseInput'
import Feedback from '../practice/Feedback'
import { play } from '../../sounds'

export default function ReviewPlayer({ items, title, onDone }: { items: ReviewItemView[]; title: string; onDone: () => void }): React.JSX.Element {
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
            {item.source === 'exam' ? 'De un examen' : 'De una práctica'} · memoria {item.stage} de {REVIEW_STEPS - 1}
          </span>
        </div>
        <p>{item.content.instruction}</p>
        <ExerciseInput key={item.id} content={item.content} answer={null} feedback={result?.feedback ?? null} onChange={setDraft} />
        {result && <Feedback type={item.type} feedback={result.feedback} />}
        {result && (
          <p className={result.feedback.correct ? 'review-next ok' : 'review-next'}>
            {result.learned
              ? `¡Aprendido! Vuelve recién el ${formatDayMonth(result.nextDue!)}, para que no se te olvide.`
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
