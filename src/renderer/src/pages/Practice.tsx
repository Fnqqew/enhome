import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EXERCISE_TYPE_LABELS,
  type ExerciseAnswer,
  type ExerciseType,
  type PracticeResult,
  type PracticeView,
  type SessionView
} from '@shared/exercises'
import { formatDayMonth, weekdayName } from '@shared/dates'
import ExerciseInput from '../components/practice/ExerciseInput'
import Feedback from '../components/practice/Feedback'
import Celebrate from '../components/Celebrate'
import ClaudeWait from '../components/ClaudeWait'
import { play } from '../sounds'
import FocusToggle from '../components/FocusToggle'
import Icon from '../components/Icon'
import { announceRewards } from '../rewardsBus'
import Rating from '../components/Rating'
import SelectionAsk from '../components/summaries/SelectionAsk'
import SpeechControls from '../components/summaries/SpeechControls'
import { useDayChange, useMinutesToMidnight } from '../hooks/useDay'
import type { Navigate } from '../navigation'
import { SkeletonCard } from '../components/Skeleton'

// Desde cuántos minutos antes de medianoche se avisa durante una práctica.
const MIDNIGHT_WARNING_MINUTES = 30

// Los que no se corrigen solos: la espera es más larga y conviene avisarlo.
const CORRECTED_BY_CLAUDE: ExerciseType[] = ['translation', 'translation_set', 'dialogue', 'roleplay', 'writing']

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
    body = <SkeletonCard lines={5} />
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
  const contentRef = useRef<HTMLDivElement>(null)
  // Los ejemplos van en cursiva para que se lean con la voz del idioma del curso.
  const speechText = [
    view.subtopicTitle,
    view.goal,
    'Puntos clave:',
    ...view.keyPoints,
    'Ejemplos:',
    ...view.examples.map((e) => `*${e.target}* — ${e.es}`)
  ].join('\n')

  return (
    <section className="card stack">
      <div className="card-header">
        <div>
          <Heading purpose={view.purpose} unitIndex={view.unitIndex} topicTitle={view.topicTitle} />
          <h2>{view.subtopicTitle}</h2>
        </div>
        {view.kind !== 'lesson' && <span className="badge">{view.kind === 'focus' ? 'Refuerzo' : 'Repaso'}</span>}
      </div>
      <SpeechControls getText={() => speechText} />
      <div ref={contentRef} className="stack">
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
                <span className="en">{example.target}</span> <span className="muted">— {example.es}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted small">Seleccioná un texto para preguntarle a Claude.</p>
      <SelectionAsk containerRef={contentRef} topicId={view.topicId} />
      <div className="row">
        <button className="btn" disabled={starting} onClick={onStart}>
          {starting ? 'Preparando ejercicios…' : 'Empezar práctica'}
        </button>
        {starting && (
          <span className="muted">
            Claude está armando y revisando tus ejercicios. Empezás apenas estén los cortos; los largos se suman mientras practicás.
          </span>
        )}
      </div>
      <ClaudeWait active={starting} />
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
  const [busy, setBusy] = useState<'answer' | 'skip' | 'finish' | 'hint' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const minutesLeft = useMinutesToMidnight()

  const pending = session.exercises.find((e) => !e.feedback)
  const current = session.exercises.find((e) => e.id === shownId) ?? pending

  // Orden de foco con teclado: al corregir, el foco pasa a «Siguiente»; con un ejercicio nuevo,
  // a su encabezado, así se sigue con Tab desde ahí sin volver al principio de la página.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // Con el ejercicio ya corregido se puede seleccionar una palabra para traducirla o preguntar.
  const exerciseRef = useRef<HTMLFormElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (current?.feedback) nextRef.current?.focus()
    else headingRef.current?.focus()
  }, [current?.id, current?.feedback])
  // Los largos que todavía están llegando también cuentan en el total.
  const total = session.exercises.length + session.pendingCount
  const position = current ? session.exercises.indexOf(current) + 1 : session.exercises.length

  // Mientras Claude termina los ejercicios largos, se consulta cada pocos segundos.
  const waiting = session.pendingCount > 0 && !session.pendingError
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      window.api
        .getPractice()
        .then(onView)
        .catch(() => undefined)
    }, 3000)
    return () => clearInterval(timer)
  }, [waiting, onView])

  const run = <T,>(kind: 'answer' | 'skip' | 'finish' | 'hint', action: () => Promise<T>, done: (value: T) => void): void => {
    setBusy(kind)
    setError(null)
    action()
      .then(done)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null))
  }

  const check = (): void => {
    if (!current || current.feedback || !draft || busy) return
    const exerciseId = current.id
    run(
      'answer',
      () => window.api.answerExercise(exerciseId, draft),
      (next) => {
        announceRewards()
        if (next.status === 'session') {
          const answered = next.session.exercises.find((e) => e.id === exerciseId)
          if (answered?.feedback) play(answered.feedback.correct ? 'correct' : 'wrong')
        }
        onView(next)
        setShownId(exerciseId)
        setDraft(null)
      }
    )
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    check()
  }

  const goNext = (): void => {
    setShownId(null)
    setDraft(null)
  }

  const canHint = !!current && !current.feedback && !current.hint && session.hintsAvailable > 0 && busy === null
  const askHint = (): void => {
    if (!current || !canHint) return
    run('hint', () => window.api.usePracticeHint(current.id).then(() => window.api.getPractice()), onView)
  }

  const canSkip = !!current && !current.feedback && session.spareCount > 0 && busy === null
  const skip = (): void => {
    if (!current || !canSkip) return
    run(
      'skip',
      () => window.api.skipExercise(current.id),
      (next) => {
        onView(next)
        setDraft(null)
      }
    )
  }

  // Atajos: Enter comprueba y sigue (Ctrl+Enter en los textos largos), Ctrl+H pide una pista y Ctrl+→ cambia el ejercicio.
  const keys = useRef({ check, goNext, askHint, skip, current })
  keys.current = { check, goNext, askHint, skip, current }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const { check, goNext, askHint, skip, current } = keys.current
      const target = event.target as HTMLElement | null
      if (event.ctrlKey && event.key.toLowerCase() === 'h') {
        event.preventDefault()
        askHint()
      } else if (event.ctrlKey && event.key === 'ArrowRight') {
        event.preventDefault()
        skip()
      } else if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
        // Un botón con foco ya responde a Enter por su cuenta, y en un texto largo Enter es un salto de línea.
        if (target?.tagName === 'BUTTON' || (target?.tagName === 'TEXTAREA' && !event.ctrlKey)) return
        if (current?.feedback) {
          event.preventDefault()
          goNext()
        } else if (event.ctrlKey || target?.tagName !== 'INPUT') {
          event.preventDefault()
          check()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const answeredCount = session.exercises.filter((e) => e.feedback).length
  return (
    <section className={`card stack exercise-card${current?.feedback ? ' has-feedback' : ''}`}>
      <div className="exercise-progress" aria-hidden="true">
        <span style={{ width: `${(answeredCount / Math.max(total, 1)) * 100}%` }} />
      </div>
      <div className="card-header">
        <div>
          <Heading purpose={session.purpose} unitIndex={session.unitIndex} topicTitle={session.topicTitle} />
          <h2>{session.subtopicTitle}</h2>
        </div>
        <div className="row header-tools">
          <FocusToggle />
          <span className="muted">
            {position} / {total}
          </span>
        </div>
      </div>

      <div className="dots" role="group" aria-label="Ejercicios de la práctica">
        {session.exercises.map((e, i) => {
          const className = `dot${e.feedback ? (e.feedback.correct ? ' correct' : ' wrong') : ''}${e === current ? ' current' : ''}`
          const state = e.feedback ? (e.feedback.correct ? 'bien' : 'con errores') : 'sin responder'
          // Los ya respondidos se pueden volver a abrir para releer la corrección.
          return e.feedback ? (
            <button
              key={e.id}
              type="button"
              className={`${className} dot-button`}
              aria-label={`Ejercicio ${i + 1}: ${state}. Ver de nuevo`}
              aria-current={e === current ? 'step' : undefined}
              onClick={() => {
                setShownId(e.id)
                setDraft(null)
              }}
            />
          ) : (
            <span key={e.id} className={className} role="img" aria-label={`Ejercicio ${i + 1}: ${state}`} />
          )
        })}
        {Array.from({ length: session.pendingCount }, (_, i) => (
          <span key={`pending-${i}`} className="dot pending" />
        ))}
      </div>

      {minutesLeft <= MIDNIGHT_WARNING_MINUTES && (
        <div className="notice warn">
          {minutesLeft === 1 ? 'Falta 1 minuto' : `Faltan ${minutesLeft} minutos`} para las 00:00. La práctica cuenta para el día en que la terminás.
        </div>
      )}

      {current ? (
        <form ref={exerciseRef} className="stack" onSubmit={submit}>
          {/* En pantallas anchas, la corrección queda en un panel al costado del ejercicio. */}
          <div className="exercise-layout">
            <div className="exercise-main stack">
              <h3 ref={headingRef} tabIndex={-1} className="exercise-type exercise-heading">
                {EXERCISE_TYPE_LABELS[current.type]}
              </h3>
              <p>{current.content.instruction}</p>
              <ExerciseInput key={current.id} content={current.content} answer={current.answer} feedback={current.feedback} onChange={setDraft} />
              {current.hint && !current.feedback && (
                <div className="notice with-icon">
                  <Icon name="bulb" className="glyph" />
                  <span>{current.hint}</span>
                </div>
              )}
            </div>
            {current.feedback && (
              <div className="exercise-side">
                <Feedback type={current.type} feedback={current.feedback} />
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <ClaudeWait active={busy === 'answer'} />

          {!current.feedback ? (
            <div className="row">
              <button className="btn" type="submit" disabled={!draft || busy !== null}>
                {busy === 'answer' ? (CORRECTED_BY_CLAUDE.includes(current.type) ? 'Claude está corrigiendo…' : 'Comprobando…') : 'Comprobar'}
              </button>
              {!current.hint && (
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!canHint}
                  title={session.hintsAvailable === 0 ? 'Ganás pistas cada 3 días de racha' : 'Ctrl+H'}
                  onClick={askHint}
                >
                  <Icon name="bulb" className="glyph" /> Pista ({session.hintsAvailable})
                </button>
              )}
              <button
                className="btn secondary"
                type="button"
                disabled={!canSkip}
                title={session.spareCount === 0 ? 'No quedan ejercicios alternativos' : 'Ctrl+→'}
                onClick={skip}
              >
                Cambiar ejercicio
              </button>
            </div>
          ) : (
            <div className="row spread">
              <Rating
                value={current.rating}
                onRate={(value) =>
                  window.api
                    .rateExercise(current.id, value)
                    .then(onView)
                    .catch((err: Error) => setError(err.message))
                }
              />
              <button ref={nextRef} className="btn" type="button" title="Enter" onClick={goNext}>
                {pending ? 'Siguiente' : 'Ver resultado'}
              </button>
            </div>
          )}
          {current.feedback && <SelectionAsk containerRef={exerciseRef} topicId={session.topicId} />}
          <p className="muted small shortcuts">
            <kbd>Enter</kbd> comprobar y seguir · <kbd>Ctrl</kbd>+<kbd>H</kbd> pista · <kbd>Ctrl</kbd>+<kbd>→</kbd> cambiar ejercicio
          </p>
        </form>
      ) : session.pendingCount > 0 ? (
        <div className="stack">
          {session.pendingError ? (
            <>
              <p className="error multiline">No llegaron los ejercicios largos: {session.pendingError}</p>
              <div>
                <button className="btn" disabled={busy !== null} onClick={() => run('finish', () => window.api.startPractice(), onView)}>
                  Reintentar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="waiting-long">
                <span className="spinner" aria-hidden="true" />
                Ya hiciste los cortos. Claude está terminando{' '}
                {session.pendingCount === 1 ? 'el ejercicio largo' : `los ${session.pendingCount} ejercicios largos`} (la conversación y la tanda de
                traducción): aparecen acá solos en unos segundos.
              </p>
              <ClaudeWait active />
            </>
          )}
        </div>
      ) : (
        <div className="stack">
          <p>Respondiste todos los ejercicios.</p>
          {error && <p className="error">{error}</p>}
          <div>
            <button
              className="btn"
              disabled={busy !== null}
              onClick={() =>
                run(
                  'finish',
                  () => window.api.finishPractice(session.id),
                  (result) => {
                    announceRewards()
                    onFinished(result)
                  }
                )
              }
            >
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
    <section className="card stack celebrate-host">
      <Celebrate active={result.correct === result.total} />
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
