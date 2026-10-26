// La práctica en curso: un ejercicio por vez, la corrección y el avance.

import { useEffect, useRef, useState } from 'react'
import { EXERCISE_TYPE_LABELS, type ExerciseAnswer, type PracticeResult, type PracticeView, type SessionView } from '@shared/exercises'
import ExerciseInput from './ExerciseInput'
import Feedback from './Feedback'
import ClaudeWait from '../ClaudeWait'
import { play } from '../../sounds'
import FocusToggle from '../FocusToggle'
import Icon from '../Icon'
import { announceRewards } from '../../rewardsBus'
import Rating from '../Rating'
import SelectionAsk from '../summaries/SelectionAsk'
import { useMinutesToMidnight } from '../../hooks/useDay'
import Heading from './Heading'

// Desde cuántos minutos antes de medianoche se avisa durante una práctica.
const MIDNIGHT_WARNING_MINUTES = 30

export default function SessionPlayer({
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

  // El próximo sin responder (lo que corrige Claude no frena: se sigue mientras llega la corrección).
  const pending = session.exercises.find((e) => !e.answer)
  const current = session.exercises.find((e) => e.id === shownId) ?? pending
  const grading = session.exercises.filter((e) => e.grading)
  const gradingFailed = session.exercises.filter((e) => e.gradingError)

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
    if (current?.answer) nextRef.current?.focus()
    else headingRef.current?.focus()
  }, [current?.id, current?.answer])
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

  // Cuando llega una corrección de Claude se actualiza la práctica; si es la que está a la vista, suena.
  const gradingIds = useRef(new Set<number>())
  useEffect(() => {
    for (const e of session.exercises) {
      if (gradingIds.current.has(e.id) && e.feedback && e.id === current?.id) play(e.feedback.correct ? 'correct' : 'wrong')
    }
    gradingIds.current = new Set(session.exercises.filter((e) => e.grading).map((e) => e.id))
  }, [session, current?.id])
  useEffect(
    () =>
      window.api.onPracticeGraded(() => {
        window.api
          .getPractice()
          .then(onView)
          .catch(() => undefined)
      }),
    [onView]
  )

  const run = <T,>(kind: 'answer' | 'skip' | 'finish' | 'hint', action: () => Promise<T>, done: (value: T) => void): void => {
    setBusy(kind)
    setError(null)
    action()
      .then(done)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null))
  }

  const check = (): void => {
    if (!current || current.answer || !draft || busy) return
    const exerciseId = current.id
    run(
      'answer',
      () => window.api.answerExercise(exerciseId, draft),
      (next) => {
        announceRewards()
        if (next.status === 'session') {
          const answered = next.session.exercises.find((e) => e.id === exerciseId)
          if (answered?.feedback) play(answered.feedback.correct ? 'correct' : 'wrong')
          // Le erró la primera vez: queda en el mismo ejercicio para el segundo intento.
          else if (answered?.retry) play('wrong')
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

  const canHint = !!current && !current.answer && !current.hint && session.hintsAvailable > 0 && busy === null
  const askHint = (): void => {
    if (!current || !canHint) return
    run('hint', () => window.api.usePracticeHint(current.id).then(() => window.api.getPractice()), onView)
  }

  const canSkip = !!current && !current.answer && session.spareCount > 0 && busy === null
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
        if (current?.answer) {
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

  const answeredCount = session.exercises.filter((e) => e.answer).length
  const regrade = (exerciseId: number): void => run('answer', () => window.api.regradeExercise(exerciseId), onView)
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
          const mark = e.feedback ? (e.feedback.correct ? ' correct' : ' wrong') : e.answer ? ' grading' : ''
          const className = `dot${mark}${e === current ? ' current' : ''}`
          const state = e.feedback ? (e.feedback.correct ? 'bien' : 'con errores') : e.answer ? 'Claude lo está corrigiendo' : 'sin responder'
          // Los ya respondidos se pueden volver a abrir para releer la corrección.
          return e.answer ? (
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
                {current.repeat && ' · otra vez'}
              </h3>
              {current.repeat && !current.answer && (
                <p className="muted small">Este te costó: vuelve al final para que lo fijes. No cuenta en el puntaje.</p>
              )}
              <p>{current.content.instruction}</p>
              <ExerciseInput
                key={current.id}
                content={current.content}
                answer={current.answer}
                feedback={current.feedback}
                locked={!!current.answer}
                onChange={setDraft}
              />
              {current.retry && !current.answer && (
                <div className="notice warn with-icon retry-notice" role="status">
                  <Icon name="retry" className="glyph" />
                  <span>
                    <strong>Todavía no.</strong> {current.retry} Probá de nuevo.
                  </span>
                </div>
              )}
              {current.hint && !current.answer && (
                <div className="notice with-icon">
                  <Icon name="bulb" className="glyph" />
                  <span>{current.hint}</span>
                </div>
              )}
            </div>
            {current.feedback ? (
              <div className="exercise-side">
                <Feedback type={current.type} feedback={current.feedback} />
              </div>
            ) : current.grading ? (
              <div className="exercise-side">
                <p className="notice grading-notice" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Claude está corrigiendo tu respuesta. Seguí con el próximo: la corrección aparece acá sola.
                </p>
              </div>
            ) : current.gradingError ? (
              <div className="exercise-side stack-sm">
                <p className="error multiline">No se pudo corregir: {current.gradingError}</p>
                <div>
                  <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => regrade(current.id)}>
                    Reintentar la corrección
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {error && <p className="error">{error}</p>}
          {!current.answer ? (
            <div className="row">
              <button className="btn" type="submit" disabled={!draft || busy !== null}>
                {busy === 'answer' ? 'Comprobando…' : 'Comprobar'}
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
              {current.feedback ? (
                <Rating
                  value={current.rating}
                  onRate={(value) =>
                    window.api
                      .rateExercise(current.id, value)
                      .then(onView)
                      .catch((err: Error) => setError(err.message))
                  }
                />
              ) : (
                <span />
              )}
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
          {grading.length > 0 && (
            <p className="waiting-long" role="status">
              <span className="spinner" aria-hidden="true" />
              Claude está terminando de corregir {grading.length === 1 ? 'un ejercicio' : `${grading.length} ejercicios`}. Mientras tanto podés releer
              las correcciones tocando los puntos de arriba.
            </p>
          )}
          {gradingFailed.length > 0 && (
            <p className="error">
              No se {gradingFailed.length === 1 ? 'pudo corregir un ejercicio' : `pudieron corregir ${gradingFailed.length} ejercicios`}: abrilo desde
              los puntos de arriba y tocá «Reintentar la corrección».
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <div>
            <button
              className="btn"
              disabled={busy !== null || !session.canFinish}
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
