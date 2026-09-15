import { useCallback, useEffect, useState } from 'react'
import {
  EXERCISE_TYPE_LABELS,
  type ExerciseAnswer,
  type PracticeRating,
  type PracticeResult,
  type PracticeView,
  type SessionView
} from '@shared/exercises'
import { formatDayMonth, weekdayName } from '@shared/dates'
import ExerciseInput from '../components/practice/ExerciseInput'
import Feedback from '../components/practice/Feedback'
import { useDayChange, useMinutesToMidnight } from '../hooks/useDay'
import type { Navigate } from '../navigation'

// Desde cuántos minutos antes de medianoche se avisa durante una práctica.
const MIDNIGHT_WARNING_MINUTES = 30

const RATINGS: { value: PracticeRating; label: string }[] = [
  { value: 1, label: 'No me sirvió' },
  { value: 3, label: 'Estuvo bien' },
  { value: 5, label: 'Me encantó' }
]

export default function Practice({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [view, setView] = useState<PracticeView | null>(null)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const load = useCallback(() => {
    setError(null)
    window.api
      .getPractice()
      .then(setView)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  const [dayNotice, setDayNotice] = useState<string | null>(null)
  useDayChange((today) => {
    setDayNotice(`Empezó un nuevo día: ${weekdayName(today)} ${formatDayMonth(today)}. La práctica se actualizó.`)
    load()
  })

  const start = (): void => {
    setStarting(true)
    setError(null)
    window.api
      .startPractice()
      .then(setView)
      .catch((err: Error) => setError(err.message))
      .finally(() => setStarting(false))
  }

  let body: React.ReactNode = null
  if (result) {
    body = (
      <ResultCard
        result={result}
        onHome={() => navigate('inicio')}
        onContinue={() => {
          setResult(null)
          load()
        }}
      />
    )
  } else if (view?.status === 'unavailable') {
    body = (
      <section className="card stack">
        <p>{view.reason}</p>
        <div>
          <button className="btn secondary" onClick={() => navigate('inicio')}>
            Volver al inicio
          </button>
        </div>
      </section>
    )
  } else if (view?.status === 'ready') {
    body = <Intro view={view} starting={starting} onStart={start} />
  } else if (view?.status === 'session') {
    body = <SessionPlayer key={view.session.id} session={view.session} onView={setView} onFinished={setResult} />
  } else if (!error) {
    body = <p className="muted">Cargando…</p>
  }

  return (
    <>
      <h1>Práctica</h1>
      {dayNotice && <div className="notice day-notice">{dayNotice}</div>}
      {error && (
        <section className="card stack">
          <p className="error multiline">{error}</p>
          <div>
            <button className="btn secondary" onClick={load}>
              Reintentar
            </button>
          </div>
        </section>
      )}
      {body}
    </>
  )
}

function Heading({ purpose, unitIndex, topicTitle }: { purpose: string; unitIndex: number | null; topicTitle: string }): React.JSX.Element {
  return (
    <span className="level">
      {purpose === 'recovery' ? 'RECUPERACIÓN DEL DOMINGO' : `DÍA ${unitIndex}`} · {topicTitle.toUpperCase()}
    </span>
  )
}

function Intro({
  view,
  starting,
  onStart
}: {
  view: Extract<PracticeView, { status: 'ready' }>
  starting: boolean
  onStart: () => void
}): React.JSX.Element {
  return (
    <section className="card stack">
      <div className="card-header">
        <div>
          <Heading purpose={view.purpose} unitIndex={view.unitIndex} topicTitle={view.topicTitle} />
          <h2>{view.subtopicTitle}</h2>
        </div>
        {view.kind !== 'lesson' && <span className="badge">{view.kind === 'focus' ? 'Refuerzo' : 'Repaso'}</span>}
      </div>
      <p>{view.goal}</p>
      <div>
        <h3 className="level">PUNTOS CLAVE</h3>
        <ul>
          {view.keyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="level">EJEMPLOS</h3>
        <ul className="examples">
          {view.examples.map((example, i) => (
            <li key={i}>
              <span className="en">{example.en}</span> <span className="muted">— {example.es}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="row">
        <button className="btn" disabled={starting} onClick={onStart}>
          {starting ? 'Preparando ejercicios…' : 'Empezar práctica'}
        </button>
        {starting && <span className="muted">Puede tardar hasta un minuto: Claude está armando tus ejercicios.</span>}
      </div>
    </section>
  )
}

function SessionPlayer({
  session,
  onView,
  onFinished
}: {
  session: SessionView
  onView: (view: PracticeView) => void
  onFinished: (result: PracticeResult) => void
}): React.JSX.Element {
  const [shownId, setShownId] = useState<number | null>(null)
  const [draft, setDraft] = useState<ExerciseAnswer | null>(null)
  const [busy, setBusy] = useState<'answer' | 'skip' | 'finish' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const minutesLeft = useMinutesToMidnight()

  const pending = session.exercises.find((e) => !e.feedback)
  const current = session.exercises.find((e) => e.id === shownId) ?? pending
  const total = session.exercises.length
  const position = current ? session.exercises.indexOf(current) + 1 : total

  const run = <T,>(kind: 'answer' | 'skip' | 'finish', action: () => Promise<T>, done: (value: T) => void): void => {
    setBusy(kind)
    setError(null)
    action()
      .then(done)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null))
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (!current || current.feedback || !draft || busy) return
    const exerciseId = current.id
    run('answer', () => window.api.answerExercise(exerciseId, draft), (next) => {
      onView(next)
      setShownId(exerciseId)
      setDraft(null)
    })
  }

  return (
    <section className="card stack">
      <div className="card-header">
        <div>
          <Heading purpose={session.purpose} unitIndex={session.unitIndex} topicTitle={session.topicTitle} />
          <h2>{session.subtopicTitle}</h2>
        </div>
        <span className="muted">
          {position} / {total}
        </span>
      </div>

      <div className="dots" aria-hidden>
        {session.exercises.map((e) => (
          <span
            key={e.id}
            className={`dot${e.feedback ? (e.feedback.correct ? ' correct' : ' wrong') : ''}${e === current ? ' current' : ''}`}
          />
        ))}
      </div>

      {minutesLeft <= MIDNIGHT_WARNING_MINUTES && (
        <div className="notice warn">
          {minutesLeft === 1 ? 'Falta 1 minuto' : `Faltan ${minutesLeft} minutos`} para las 00:00. La práctica cuenta para el día en que
          la terminás.
        </div>
      )}

      {current ? (
        <form className="stack" onSubmit={submit}>
          <span className="exercise-type">{EXERCISE_TYPE_LABELS[current.type]}</span>
          <p>{current.content.instruction}</p>
          <ExerciseInput key={current.id} content={current.content} answer={current.answer} feedback={current.feedback} onChange={setDraft} />
          {current.feedback && <Feedback type={current.type} feedback={current.feedback} />}
          {error && <p className="error">{error}</p>}

          {!current.feedback ? (
            <div className="row">
              <button className="btn" type="submit" disabled={!draft || busy !== null}>
                {busy === 'answer' ? (current.type === 'writing' || current.type === 'translation' ? 'Corrigiendo…' : 'Comprobando…') : 'Comprobar'}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={session.spareCount === 0 || busy !== null}
                title={session.spareCount === 0 ? 'No quedan ejercicios alternativos' : undefined}
                onClick={() =>
                  run('skip', () => window.api.skipExercise(current.id), (next) => {
                    onView(next)
                    setDraft(null)
                  })
                }
              >
                Cambiar ejercicio
              </button>
            </div>
          ) : (
            <div className="row spread">
              <div className="rating" role="group" aria-label="¿Qué te pareció este ejercicio?">
                <span className="muted">¿Qué te pareció?</span>
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className="chip"
                    aria-pressed={current.rating === r.value}
                    onClick={() => window.api.rateExercise(current.id, r.value).then(onView).catch((err: Error) => setError(err.message))}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShownId(null)
                  setDraft(null)
                }}
              >
                {pending ? 'Siguiente' : 'Ver resultado'}
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className="stack">
          <p>Respondiste todos los ejercicios.</p>
          {error && <p className="error">{error}</p>}
          <div>
            <button className="btn" disabled={busy !== null} onClick={() => run('finish', () => window.api.finishPractice(session.id), onFinished)}>
              {busy === 'finish' ? 'Guardando…' : 'Terminar práctica'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ResultCard({ result, onHome, onContinue }: { result: PracticeResult; onHome: () => void; onContinue: () => void }): React.JSX.Element {
  const ratio = result.correct / result.total
  const message =
    ratio >= 0.8
      ? '¡Muy bien! Dominás este tema.'
      : ratio >= 0.5
        ? 'Vas bien encaminado. Repasá los ejercicios donde fallaste.'
        : 'Este tema necesita más práctica. Releé los puntos clave y el resumen.'

  return (
    <section className="card stack">
      <h2>{result.purpose === 'recovery' ? 'Recuperaste una falta' : `Terminaste la práctica del día ${result.unitIndex}`}</h2>
      <p className="big">
        {result.correct} de {result.total} correctos
      </p>
      <p>{message}</p>
      <div className="row">
        <button className="btn" onClick={onHome}>
          Volver al inicio
        </button>
        <button className="btn secondary" onClick={onContinue}>
          Seguir practicando
        </button>
      </div>
    </section>
  )
}
