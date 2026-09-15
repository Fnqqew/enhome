import { useEffect, useRef, useState } from 'react'
import { EXAM_INTERRUPTED_MESSAGE, type ExamResultView, type ExamSessionView } from '@shared/exams'
import { EXERCISE_TYPE_LABELS, type ExerciseAnswer } from '@shared/exercises'
import ExerciseInput from '../practice/ExerciseInput'

// Señal periódica para que la app sepa que el examen sigue abierto.
const HEARTBEAT_MS = 20_000
const SAVE_DELAY_MS = 500

interface PendingSave {
  index: number
  answer: ExerciseAnswer | null
  timer: ReturnType<typeof setTimeout>
}

export default function ExamPlayer({
  session,
  onSubmitted,
  onLeave
}: {
  session: ExamSessionView
  onSubmitted: (result: ExamResultView) => void
  // Se interrumpió o se descartó: volver a la vista general.
  onLeave: () => void
}): React.JSX.Element {
  const total = session.questions.length
  const [answers, setAnswers] = useState<(ExerciseAnswer | null)[]>(() => session.questions.map((q) => q.answer))
  const [index, setIndex] = useState(() => Math.max(0, session.questions.findIndex((q) => !q.answer)))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<PendingSave | null>(null)
  const latest = useRef({ onLeave })
  latest.current = { onLeave }

  const fail = (err: Error): void => {
    if (err.message === EXAM_INTERRUPTED_MESSAGE) latest.current.onLeave()
    else setError(err.message)
  }

  const flush = (): Promise<void> => {
    const save = pending.current
    if (!save) return Promise.resolve()
    clearTimeout(save.timer)
    pending.current = null
    return window.api.saveExamAnswer(session.id, save.index, save.answer).catch(fail)
  }

  const onChange = (answer: ExerciseAnswer | null): void => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? answer : a)))
    if (pending.current && pending.current.index !== index) void flush()
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = { index, answer, timer: setTimeout(() => void flush(), SAVE_DELAY_MS) }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      window.api.examHeartbeat(session.id).catch(fail)
    }, HEARTBEAT_MS)
    return () => {
      clearInterval(timer)
      void flush()
    }
  }, [session.id])

  const go = (target: number): void => {
    void flush()
    setIndex(target)
  }

  const submit = async (): Promise<void> => {
    const unanswered = answers.filter((a) => !a).length
    if (unanswered > 0 && !confirm(`Te ${unanswered === 1 ? 'queda 1 pregunta' : `quedan ${unanswered} preguntas`} sin responder: cuentan como incorrectas. ¿Entregás igual?`)) {
      return
    }
    setSubmitting(true)
    setError(null)
    await flush()
    window.api
      .submitExam(session.id)
      .then(onSubmitted)
      .catch((err: Error) => {
        setSubmitting(false)
        fail(err)
      })
  }

  const question = session.questions[index]
  const answeredCount = answers.filter(Boolean).length

  return (
    <section className="card wide stack">
      <div className="card-header">
        <div>
          <span className="level">{session.kind === 'weekly' ? 'EXAMEN SEMANAL' : 'SIMULACRO'}</span>
          <h2>{session.title}</h2>
        </div>
        <span className="muted">
          {answeredCount} de {total} respondidas
        </span>
      </div>

      {session.kind === 'weekly' && (
        <p className="muted small">
          No podés salir de Pruebas hasta entregar.
          {session.pauseUsed && ' Ya usaste la pausa de este examen: si se vuelve a interrumpir, se entrega con lo que tengas.'}
        </p>
      )}

      <nav className="question-nav" aria-label="Preguntas">
        {session.questions.map((q, i) => (
          <button
            key={q.index}
            type="button"
            className={`qnav${answers[i] ? ' answered' : ''}`}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Pregunta ${i + 1}${answers[i] ? ', respondida' : ''}`}
            onClick={() => go(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <div className="stack">
        <div className="row spread">
          <span className="exercise-type">{EXERCISE_TYPE_LABELS[question.type]}</span>
          <span className="muted small">
            Pregunta {index + 1} · {question.topicTitle} › {question.subtopicTitle}
          </span>
        </div>
        <p>{question.content.instruction}</p>
        <ExerciseInput key={`${session.id}-${index}`} content={question.content} answer={answers[index]} feedback={null} onChange={onChange} />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row spread">
        <div className="row">
          <button className="btn secondary" disabled={index === 0 || submitting} onClick={() => go(index - 1)}>
            ← Anterior
          </button>
          <button className="btn secondary" disabled={index === total - 1 || submitting} onClick={() => go(index + 1)}>
            Siguiente →
          </button>
        </div>
        <div className="row">
          {session.kind === 'mock' && (
            <button
              className="btn secondary"
              disabled={submitting}
              onClick={() => {
                if (confirm('¿Descartar el simulacro? Se pierde lo respondido.')) {
                  window.api.discardMockExam(session.id).then(onLeave).catch(fail)
                }
              }}
            >
              Descartar
            </button>
          )}
          <button className="btn" disabled={submitting} onClick={() => void submit()}>
            {submitting ? 'Corrigiendo…' : 'Entregar'}
          </button>
        </div>
      </div>
      {submitting && <p className="muted small">Corrigiendo: las traducciones y la escritura las corrige Claude, puede tardar unos segundos.</p>}
    </section>
  )
}
