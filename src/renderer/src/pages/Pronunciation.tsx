// Pronunciación: la guía del idioma para leer y escuchar, y un juego rápido con los pares mínimos.

import { useEffect, useState } from 'react'
import type { PronunciationGuide } from '@shared/pronunciation'
import type { WritingCourse } from '@shared/writing'
import WritingCourseView from '../components/pronunciation/WritingCourse'
import Icon from '../components/Icon'
import { SkeletonCard } from '../components/Skeleton'
import { useCourse } from '../hooks/useCourse'
import { useSpeech } from '../hooks/useSpeech'

export default function Pronunciation(): React.JSX.Element {
  const course = useCourse()
  const speech = useSpeech()
  const [guide, setGuide] = useState<PronunciationGuide | null | undefined>(undefined)
  const [writing, setWriting] = useState<WritingCourse | null>(null)
  const [tab, setTab] = useState<'pronunciation' | 'writing'>('pronunciation')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGuide(undefined)
    setWriting(null)
    Promise.all([window.api.getPronunciation(), window.api.getWriting()])
      .then(([g, w]) => {
        setGuide(g)
        setWriting(w)
        // En los idiomas con otro alfabeto se empieza por la escritura.
        setTab(w ? 'writing' : 'pronunciation')
      })
      .catch((err: Error) => setError(err.message))
  }, [course.id])

  const tabs = writing && (
    <div className="segmented" role="tablist" aria-label="Pronunciación o escritura">
      <button
        type="button"
        role="tab"
        className="chip"
        aria-selected={tab === 'writing'}
        aria-pressed={tab === 'writing'}
        onClick={() => setTab('writing')}
      >
        Escritura
      </button>
      <button
        type="button"
        role="tab"
        className="chip"
        aria-selected={tab === 'pronunciation'}
        aria-pressed={tab === 'pronunciation'}
        onClick={() => setTab('pronunciation')}
      >
        Pronunciación
      </button>
    </div>
  )

  const say = (text: string, slower = false): void => speech.speakAs(text, course.id, slower)

  if (error) {
    return (
      <>
        <h1>Pronunciación</h1>
        <p className="error">{error}</p>
      </>
    )
  }
  if (guide === undefined) {
    return (
      <>
        <h1>Pronunciación</h1>
        <SkeletonCard lines={5} />
      </>
    )
  }
  if (writing && tab === 'writing') {
    return (
      <>
        <h1>Pronunciación</h1>
        {tabs}
        <WritingCourseView course={writing} />
      </>
    )
  }
  if (guide === null) {
    return (
      <>
        <h1>Pronunciación</h1>
        {tabs}
        <section className="card">
          <p className="muted">La guía de pronunciación de {course.name} todavía no está escrita.</p>
        </section>
      </>
    )
  }

  return (
    <>
      <h1>Pronunciación</h1>
      {tabs}
      <section className="card stack fade-in">
        <span className="level">GUÍA DE PRONUNCIACIÓN · {course.name.toUpperCase()}</span>
        <p>{guide.intro}</p>
        <p className="muted small">Tocá cualquier ejemplo para escucharlo; con «Despacio» suena más lento.</p>
      </section>

      <PairQuiz pairs={guide.pairs} say={say} />

      {guide.sounds.map((sound) => (
        <section key={sound.title} className="card stack fade-in">
          <h2>{sound.title}</h2>
          <p>{sound.description}</p>
          <ul className="examples lesson-examples">
            {sound.examples.map((example) => (
              <li key={example.target}>
                <button type="button" className="icon-btn" aria-label={`Escuchar «${example.target}»`} onClick={() => say(example.target)}>
                  <Icon name="play" className="glyph" />
                </button>
                <button type="button" className="chip" onClick={() => say(example.target, true)} aria-label={`Escuchar despacio «${example.target}»`}>
                  Despacio
                </button>
                <span>
                  <span className="en">{example.target}</span> <span className="muted">— {example.es}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="notice with-icon">
            <Icon name="bulb" className="glyph" />
            <span>{sound.tip}</span>
          </p>
        </section>
      ))}

      <section className="card stack fade-in">
        <h2>Pares mínimos</h2>
        <p className="muted">Dos palabras que cambian en un solo sonido: escuchalas una después de la otra.</p>
        <ul className="pron-pairs">
          {guide.pairs.map((p) => (
            <li key={`${p.a}-${p.b}`}>
              <button type="button" className="chip" onClick={() => say(p.a)}>
                <Icon name="play" className="glyph" /> <span className="en">{p.a}</span> · {p.meaningA}
              </button>
              <button type="button" className="chip" onClick={() => say(p.b)}>
                <Icon name="play" className="glyph" /> <span className="en">{p.b}</span> · {p.meaningB}
              </button>
              <span className="muted small">{p.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack fade-in">
        <h2>Acentuación</h2>
        <p>{guide.stress}</p>
        <h2>Entonación</h2>
        <p>{guide.intonation}</p>
        <h2>Variantes</h2>
        <p>{guide.variants}</p>
      </section>
    </>
  )
}

// Suena una de las dos palabras de un par y hay que elegir cuál fue.
function PairQuiz({ pairs, say }: { pairs: PronunciationGuide['pairs']; say: (text: string) => void }): React.JSX.Element {
  const [round, setRound] = useState<{ index: number; target: 0 | 1 } | null>(null)
  const [picked, setPicked] = useState<0 | 1 | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  const next = (): void => {
    const index = Math.floor(Math.random() * pairs.length)
    const target = Math.random() < 0.5 ? 0 : 1
    setRound({ index, target })
    setPicked(null)
    say(target === 0 ? pairs[index].a : pairs[index].b)
  }

  const pair = round ? pairs[round.index] : null
  return (
    <section className="card stack fade-in">
      <div className="row spread">
        <h2>¿Cuál escuchaste?</h2>
        {score.total > 0 && (
          <span className="badge">
            {score.right} de {score.total}
          </span>
        )}
      </div>
      {!round || !pair ? (
        <div>
          <button className="btn" onClick={next}>
            <Icon name="play" className="glyph" /> Probarme con los pares mínimos
          </button>
        </div>
      ) : (
        <>
          <div className="row">
            <button type="button" className="chip" onClick={() => say(round.target === 0 ? pair.a : pair.b)}>
              <Icon name="play" className="glyph" /> Escuchar de nuevo
            </button>
          </div>
          <div className="options">
            {([0, 1] as const).map((option) => {
              const word = option === 0 ? pair.a : pair.b
              const state = picked === null ? '' : option === round.target ? ' correct' : option === picked ? ' wrong' : ''
              return (
                <button
                  key={option}
                  type="button"
                  className={`option${state}`}
                  disabled={picked !== null}
                  onClick={() => {
                    setPicked(option)
                    setScore({ right: score.right + (option === round.target ? 1 : 0), total: score.total + 1 })
                  }}
                >
                  <span className="en">{word}</span>
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <div className="stack-sm fade-in">
              <p className={picked === round.target ? 'ok-text' : 'warn-text'}>
                {picked === round.target ? '¡Bien!' : 'Era la otra.'} {pair.note}
              </p>
              <div>
                <button className="btn" onClick={next}>
                  Otra
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
