import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { formatDayMonth } from '@shared/dates'
import { READING_THEMES, type ReadingSummary, type ReadingView } from '@shared/reading'
import ClaudeWait from '../components/ClaudeWait'
import Icon from '../components/Icon'
import SelectionAsk from '../components/summaries/SelectionAsk'
import { useCourse } from '../hooks/useCourse'
import { useSpeech } from '../hooks/useSpeech'

// Lecturas graduadas: Claude escribe un texto del nivel del alumno, con glosario y preguntas, y queda guardado.
export default function Readings(): React.JSX.Element {
  const course = useCourse()
  const [list, setList] = useState<ReadingSummary[] | null>(null)
  const [open, setOpen] = useState<ReadingView | null>(null)
  const [theme, setTheme] = useState<string>(READING_THEMES[0])
  const [custom, setCustom] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getReadings()
      .then(setList)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const generate = (): void => {
    setGenerating(true)
    setError(null)
    window.api
      .generateReading(custom.trim() || theme)
      .then((reading) => {
        setOpen(reading)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setGenerating(false))
  }

  if (open) {
    return (
      <>
        <div className="row spread">
          <h1>Lecturas</h1>
          <button className="btn secondary" onClick={() => setOpen(null)}>
            Volver a la lista
          </button>
        </div>
        <Reading
          reading={open}
          onAnswered={(r) => {
            setOpen(r)
            load()
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1>Lecturas</h1>
      <section className="card stack fade-in">
        <div>
          <span className="level">LECTURA NUEVA</span>
          <h2>Un texto corto en {course.name}, a tu medida</h2>
        </div>
        <p className="muted">
          Claude escribe una historia de tu nivel que usa lo que estás estudiando, con un glosario de las palabras difíciles y cuatro preguntas de
          comprensión. Queda guardada para releerla cuando quieras.
        </p>
        <div className="chip-grid" role="group" aria-label="Tema">
          {READING_THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={!custom.trim() && theme === t}
              onClick={() => {
                setTheme(t)
                setCustom('')
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          className="text-answer"
          value={custom}
          maxLength={80}
          placeholder="…o escribí un tema propio (por ejemplo: un partido de fútbol, una mudanza)"
          onChange={(e) => setCustom(e.target.value)}
        />
        <div className="row">
          <button className="btn" disabled={generating} onClick={generate}>
            {generating ? 'Escribiendo la lectura…' : 'Escribir lectura'}
          </button>
          {generating && <span className="muted small">Tarda alrededor de un minuto.</span>}
        </div>
        <ClaudeWait active={generating} />
        {error && <p className="error multiline">{error}</p>}
      </section>

      {list && list.length > 0 && (
        <section className="card stack fade-in">
          <h2>Tus lecturas</h2>
          <ul className="reading-list">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="reading-item"
                  onClick={() =>
                    window.api
                      .getReading(r.id)
                      .then(setOpen)
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  <span className="level-code">{r.level}</span>
                  <span className="reading-title">{r.title}</span>
                  <span className="muted small">{formatDayMonth(r.createdOn)}</span>
                  {r.score !== null ? <span className="badge ok">{r.score}/10</span> : <span className="badge">Sin responder</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// Marca las palabras del glosario dentro del texto, con la traducción al pasar el cursor.
function highlight(paragraph: string, glossary: ReadingView['glossary']): React.ReactNode {
  if (glossary.length === 0) return paragraph
  const escaped = [...glossary].sort((a, b) => b.term.length - a.term.length).map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return paragraph.split(pattern).map((part, i) => {
    const entry = glossary.find((g) => g.term.toLowerCase() === part.toLowerCase())
    return entry ? (
      <mark key={i} className="gloss" title={entry.translation}>
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  })
}

function Reading({ reading, onAnswered }: { reading: ReadingView; onAnswered: (r: ReadingView) => void }): React.JSX.Element {
  const speech = useSpeech()
  const textRef = useRef<HTMLDivElement>(null)
  const [answers, setAnswers] = useState<(number | null)[]>(() => reading.answers ?? reading.questions.map(() => null))
  const [error, setError] = useState<string | null>(null)
  const done = reading.answers !== null
  const paragraphs = reading.text.split(/\n\s*\n/).filter((p) => p.trim())

  return (
    <>
      <section className="card stack reading fade-in">
        <div className="card-header">
          <div>
            <span className="level">
              NIVEL {reading.level}
              {reading.topicTitle ? ` · ${reading.topicTitle.toUpperCase()}` : ''}
            </span>
            <h2 className="en">{reading.title}</h2>
          </div>
          <div className="row">
            {speech.state === 'idle' ? (
              <button type="button" className="chip" onClick={() => speech.speakAs(`${reading.title}. ${reading.text}`)}>
                <Icon name="play" className="glyph" /> Escuchar
              </button>
            ) : (
              <button type="button" className="chip" onClick={speech.stop}>
                <Icon name="stop" className="glyph" /> Detener
              </button>
            )}
          </div>
        </div>
        <div ref={textRef} className="reading-text en">
          {paragraphs.map((p, i) => (
            <p key={i}>{highlight(p, reading.glossary)}</p>
          ))}
        </div>
        <p className="muted small">Las palabras marcadas están en el glosario. Seleccioná cualquier otra para traducirla.</p>
        <SelectionAsk containerRef={textRef} topicId={reading.topicId} />
      </section>

      {reading.glossary.length > 0 && (
        <section className="card stack fade-in">
          <h2>Glosario</h2>
          <dl className="glossary">
            {reading.glossary.map((g) => (
              <div key={g.term}>
                <dt className="en">{g.term}</dt>
                <dd>{g.translation}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="card stack fade-in">
        <div className="card-header">
          <h2>Preguntas</h2>
          {reading.score !== null && <span className="badge ok">{reading.score}/10</span>}
        </div>
        {reading.questions.map((q, qi) => (
          <div key={qi} className="stack-sm">
            <p>
              <strong>{qi + 1}.</strong> {q.prompt}
            </p>
            <div className="options">
              {q.options.map((option, oi) => {
                const state = !done ? '' : oi === q.correctIndex ? ' correct' : answers[qi] === oi ? ' wrong' : ''
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`option${state}`}
                    aria-pressed={answers[qi] === oi}
                    disabled={done}
                    onClick={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {done && <p className="muted small">{q.explanation}</p>}
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        {!done && (
          <div>
            <button
              className="btn"
              disabled={answers.some((a) => a === null)}
              onClick={() =>
                window.api
                  .answerReading(reading.id, answers as number[])
                  .then(onAnswered)
                  .catch((err: Error) => setError(err.message))
              }
            >
              Comprobar
            </button>
          </div>
        )}
      </section>
    </>
  )
}
