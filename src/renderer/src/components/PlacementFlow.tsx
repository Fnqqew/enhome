import { useEffect, useState } from 'react'
import type { PlacementView } from '@shared/progress'

export default function PlacementFlow({ resume, onDone }: { resume: boolean; onDone: () => void }): React.JSX.Element {
  const [view, setView] = useState<PlacementView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<number | null>(null)

  const run = (action: () => Promise<PlacementView>): void => {
    setLoading(true)
    setError(null)
    action()
      .then((next) => {
        setView(next)
        setChoice(null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (resume) run(() => window.api.getPlacement())
  }, [resume])

  if (!view || view.status === 'not-started') {
    return (
      <section className="card stack">
        <h2>Examen inicial</h2>
        <p>
          Antes de empezar vamos a ver qué sabés. Son preguntas cortas de opción múltiple, tópico por tópico: si respondés bien al
          menos 2 de 3, pasás al siguiente. El primer tópico que te cueste es donde empieza tu recorrido.
        </p>
        <p className="muted">No hay tiempo límite. Si no sabés una respuesta, elegí «No lo sé»: así el resultado es más preciso.</p>
        {error && <p className="error">{error}</p>}
        <div>
          <button className="btn" disabled={loading} onClick={() => run(() => (resume ? window.api.getPlacement() : window.api.startPlacement()))}>
            {loading ? 'Preparando preguntas…' : resume ? 'Continuar examen' : 'Empezar'}
          </button>
        </div>
      </section>
    )
  }

  if (view.status === 'finished') {
    return (
      <section className="card stack">
        <h2>¡Listo!</h2>
        <p>
          Respondiste bien {view.correct} de {view.answered} preguntas.
        </p>
        <p>
          {view.startTopicTitle ? (
            <>
              Tu recorrido empieza en <strong>{view.startTopicTitle}</strong> ({view.level}).
            </>
          ) : (
            'Superaste todo el temario disponible por ahora.'
          )}
        </p>
        <div>
          <button className="btn" onClick={onDone}>
            Ir a mi semana
          </button>
        </div>
      </section>
    )
  }

  const { question } = view
  return (
    <section className="card stack">
      <div className="card-header">
        <span className="level">
          EXAMEN INICIAL · TÓPICO {view.topicNumber} DE {view.totalTopics}
        </span>
        <span className="muted">
          Pregunta {view.answeredInTopic + 1} de {view.questionsPerTopic}
        </span>
      </div>
      <div className="progress-bar">
        <span style={{ width: `${((view.topicNumber - 1) / view.totalTopics) * 100}%` }} />
      </div>
      <p>{question.instruction}</p>
      <p className="prompt">{question.prompt}</p>
      <div className="options">
        {question.options.map((option, i) => (
          <button key={i} className="option" aria-pressed={choice === i} disabled={loading} onClick={() => setChoice(i)}>
            {option}
          </button>
        ))}
        <button className="option muted" aria-pressed={choice === -1} disabled={loading} onClick={() => setChoice(-1)}>
          No lo sé
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        {error ? (
          <button className="btn" disabled={loading} onClick={() => run(() => window.api.getPlacement())}>
            Reintentar
          </button>
        ) : (
          <button className="btn" disabled={choice === null || loading} onClick={() => run(() => window.api.answerPlacement(question.id, choice!))}>
            {loading ? 'Guardando…' : 'Siguiente'}
          </button>
        )}
        {loading && <span className="muted">Preparar las preguntas de un tópico nuevo puede tardar unos segundos.</span>}
      </div>
    </section>
  )
}
