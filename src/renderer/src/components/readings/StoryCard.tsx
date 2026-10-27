// La historia de la semana: un capítulo por día, con los mismos personajes y el tema de ese día.

import { useCallback, useEffect, useState } from 'react'
import { STORY_CHAPTERS, type ReadingView, type StoryView } from '@shared/reading'
import ClaudeWait from '../ClaudeWait'

export default function StoryCard({ onOpen }: { onOpen: (reading: ReadingView) => void }): React.JSX.Element | null {
  const [story, setStory] = useState<StoryView | null | undefined>(undefined)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getStory()
      .then(setStory)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  if (!story) return error ? <p className="error">{error}</p> : null

  const open = (id: number): void => {
    window.api
      .getReading(id)
      .then(onOpen)
      .catch((err: Error) => setError(err.message))
  }
  const write = (): void => {
    setWriting(true)
    setError(null)
    window.api
      .nextChapter()
      .then((reading) => {
        load()
        onOpen(reading)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setWriting(false))
  }

  const count = story.chapters.length
  return (
    <section className="card stack fade-in">
      <div>
        <span className="level">LA HISTORIA DE LA SEMANA · {story.topicTitle.toUpperCase()}</span>
        <h2>{count === 0 ? 'Una historia que avanza con lo que estudiás' : `Vas por el capítulo ${count} de ${STORY_CHAPTERS}`}</h2>
      </div>
      <p className="muted">Un capítulo por día, con los mismos personajes y el tema de ese día. Cada uno trae glosario, preguntas y audio.</p>
      {count > 0 && (
        <ul className="reading-list">
          {story.chapters.map((c) => (
            <li key={c.id}>
              <button type="button" className="reading-item" onClick={() => open(c.id)}>
                <span className="level-code">{c.chapter}</span>
                <span className="reading-title">{c.title}</span>
                {c.score !== null ? <span className="badge ok">{c.score}/10</span> : <span className="badge">Sin responder</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {story.next ? (
        <div className="row">
          <button className="btn" disabled={writing} onClick={write}>
            {writing ? 'Escribiendo el capítulo…' : `Leer el capítulo ${story.next.chapter}`}
          </button>
          <span className="muted small">Usa lo de «{story.next.subtopicTitle}».</span>
        </div>
      ) : (
        <p className="muted small">{story.waitReason}</p>
      )}
      <ClaudeWait active={writing} />
      {error && <p className="error multiline">{error}</p>}
    </section>
  )
}
