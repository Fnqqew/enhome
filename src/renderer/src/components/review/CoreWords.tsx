// Las palabras del día: las siguientes del vocabulario núcleo de tu nivel, para sumarlas a las tarjetas.

import { useCallback, useEffect, useState } from 'react'
import type { CoreVocabToday } from '@shared/core-vocab'
import { useCourse } from '../../hooks/useCourse'
import { useSpeech } from '../../hooks/useSpeech'
import Icon from '../Icon'

export default function CoreWords({ onLearned }: { onLearned: () => void }): React.JSX.Element | null {
  const course = useCourse()
  const speech = useSpeech()
  const [today, setToday] = useState<CoreVocabToday | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getCoreWords()
      .then(setToday)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  if (error) return <p className="error">{error}</p>
  if (!today || today.total === 0) return null

  const learn = (): void => {
    setBusy(true)
    window.api
      .learnCoreWords(today.words.map((w) => w.term))
      .then((next) => {
        setToday(next)
        onLearned()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false))
  }

  return (
    <section className="card stack fade-in">
      <div className="row spread">
        <div>
          <span className="level">PALABRAS DEL DÍA · {today.level}</span>
          <h2>Las más usadas de tu nivel</h2>
        </div>
        <span className="badge">
          {today.learned} de {today.total}
        </span>
      </div>
      {today.words.length === 0 ? (
        <p className="muted">Ya sumaste todas las palabras núcleo de {today.level} a tus tarjetas.</p>
      ) : (
        <>
          <p className="muted small">
            Van en orden de frecuencia: las que más vas a escuchar y leer en {course.name}. Al sumarlas, vuelven en tarjetas justo antes de que se te
            olviden.
          </p>
          <ul className="examples lesson-examples">
            {today.words.map((w) => (
              <li key={w.term}>
                <button type="button" className="icon-btn" aria-label={`Escuchar «${w.term}»`} onClick={() => speech.speakAs(w.term)}>
                  <Icon name="play" className="glyph" />
                </button>
                <span>
                  <strong className="en">{w.term}</strong> <span className="muted">— {w.es}</span>
                  <br />
                  <button type="button" className="link-like en small" onClick={() => speech.speakAs(w.example)}>
                    {w.example}
                  </button>{' '}
                  <span className="muted small">{w.exampleEs}</span>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <button className="btn" disabled={busy} onClick={learn}>
              {busy ? 'Sumando…' : `Sumar estas ${today.words.length} a mis tarjetas`}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
