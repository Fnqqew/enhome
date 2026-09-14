import { useEffect, useState } from 'react'
import type { CurriculumTopic } from '@shared/curriculum'

export default function Home(): React.JSX.Element {
  return (
    <>
      <h1>Inicio</h1>
      <section className="card">
        <h2>Tu recorrido empieza pronto</h2>
        <p className="muted">
          Acá vas a ver el tópico de la semana, la práctica del día y tu racha. Todo arranca con el examen inicial, que
          llega en la fase 3.
        </p>
      </section>
      <CurriculumOverview />
    </>
  )
}

function CurriculumOverview(): React.JSX.Element {
  const [topics, setTopics] = useState<CurriculumTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getCurriculum()
      .then(setTopics)
      .catch((err: Error) => setError(err.message))
  }, [])

  const levels = topics ? [...new Set(topics.map((t) => t.level))] : []
  const reviewed = topics?.filter((t) => t.reviewed).length ?? 0

  return (
    <section className="card stack">
      <div className="card-header">
        <h2>Temario</h2>
        {topics && (
          <span className="muted">
            {topics.length} tópicos · {reviewed} revisados
          </span>
        )}
      </div>
      {error && <p className="error multiline">{error}</p>}
      {!topics && !error && <p className="muted">Cargando…</p>}
      {levels.map((level) => (
        <div key={level}>
          <h3 className="level">{level}</h3>
          <ol className="topic-list">
            {topics!
              .filter((t) => t.level === level)
              .map((t) => (
                <li key={t.id}>
                  <div>
                    <span className="topic-title">{t.title}</span>
                    <span className="muted topic-sub">{t.subtopics.map((s) => s.title).join(' · ')}</span>
                  </div>
                  <span className={`badge${t.reviewed ? ' ok' : ''}`}>{t.reviewed ? 'Revisado' : 'Sin revisar'}</span>
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
