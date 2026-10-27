// La misión de la semana: una tarea real para cerrar el tópico, por escrito o hablando, que Claude
// evalúa con una rúbrica.

import { useCallback, useEffect, useState } from 'react'
import { MISSION_RECORDING_MS, type MissionView } from '@shared/mission'
import { useCourse } from '../../hooks/useCourse'
import { useTranscriber } from '../../speech/useTranscriber'
import { countWords } from '../../exercise-types/common'
import ClaudeWait from '../ClaudeWait'
import Icon from '../Icon'

export default function MissionCard(): React.JSX.Element | null {
  const [view, setView] = useState<MissionView | null | undefined>(undefined)
  const [busy, setBusy] = useState<'create' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(() => {
    window.api
      .getMission()
      .then((v) => {
        setView(v)
        if (v?.answer) setAnswer(v.answer)
      })
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  const run = (kind: 'create' | 'submit', action: () => Promise<MissionView>): void => {
    setBusy(kind)
    setError(null)
    action()
      .then((v) => {
        setView(v)
        setRetrying(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null))
  }

  if (!view) return error ? <p className="error">{error}</p> : null
  const { mission, review } = view

  return (
    <section className="card stack fade-in">
      <div>
        <span className="level">LA MISIÓN DE LA SEMANA · {view.topicTitle.toUpperCase()}</span>
        <h2>{mission ? mission.title : 'Una tarea real para cerrar el tópico'}</h2>
      </div>

      {!mission && (
        <>
          <p className="muted">
            Usás lo de la semana en algo que te puede pasar: escribir un mail, dejar un audio, resolver un trámite. Claude la arma a tu medida y
            después la evalúa con una rúbrica, criterio por criterio.
          </p>
          {view.lockedReason ? (
            <p className="muted small">{view.lockedReason}</p>
          ) : (
            <div className="row">
              <button className="btn" disabled={busy !== null} onClick={() => run('create', () => window.api.createMission('write'))}>
                <Icon name="pencil" className="glyph" /> Una misión para escribir
              </button>
              <button className="btn secondary" disabled={busy !== null} onClick={() => run('create', () => window.api.createMission('speak'))}>
                <Icon name="mic" className="glyph" /> Una misión para decir
              </button>
            </div>
          )}
        </>
      )}

      {mission && (
        <>
          <p>{mission.situation}</p>
          <p>
            <strong>Tu tarea:</strong> {mission.task}
          </p>
          <div>
            <h3 className="level">TIENE QUE INCLUIR</h3>
            <ul>
              {mission.checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <details>
            <summary className="muted">Cómo se evalúa</summary>
            <ul>
              {mission.rubric.map((r, i) => (
                <li key={i}>
                  <strong>{r.criterion}:</strong> {r.description}
                </li>
              ))}
            </ul>
          </details>

          {review && !retrying ? (
            <MissionResult view={view} onRetry={() => setRetrying(true)} />
          ) : (
            <>
              {mission.mode === 'write' ? (
                <WriteAnswer value={answer} min={mission.minWords} max={mission.maxWords} onChange={setAnswer} />
              ) : (
                <SpeakAnswer value={answer} onChange={setAnswer} />
              )}
              <div>
                <button
                  className="btn"
                  disabled={busy !== null || !answer.trim()}
                  onClick={() => run('submit', () => window.api.submitMission(answer))}
                >
                  {busy === 'submit' ? 'Claude está evaluando…' : 'Entregar la misión'}
                </button>
              </div>
            </>
          )}
        </>
      )}
      <ClaudeWait active={busy !== null} />
      {error && <p className="error multiline">{error}</p>}
    </section>
  )
}

function WriteAnswer({ value, min, max, onChange }: { value: string; min: number; max: number; onChange: (v: string) => void }): React.JSX.Element {
  const lang = useCourse().name
  const words = countWords(value)
  return (
    <>
      <textarea
        className="text-answer"
        rows={7}
        value={value}
        placeholder={`Escribí en ${lang}…`}
        aria-label="Tu respuesta"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={words > 0 && (words < min || words > max) ? 'warn-text' : 'muted'}>
        {words} palabras · entre {min} y {max}
      </p>
    </>
  )
}

function SpeakAnswer({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const course = useCourse()
  const asr = useTranscriber(course.id)
  const percent = asr.progress && asr.progress.total > 0 ? Math.round((asr.progress.loaded / asr.progress.total) * 100) : 0

  if (asr.state === 'idle' || asr.state === 'loading') {
    return (
      <div className="stack-sm">
        <p className="muted small">Para escucharte, un reconocimiento de voz corre en tu computadora (lo que grabás no sale de acá).</p>
        {asr.state === 'loading' ? (
          <span className="muted small">{percent > 0 && percent < 100 ? `Descargando el modelo: ${percent} %` : 'Preparando…'}</span>
        ) : (
          <div>
            <button type="button" className="btn secondary" onClick={asr.load}>
              <Icon name="mic" className="glyph" /> Preparar el micrófono
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stack-sm">
      <div className="row">
        {asr.state === 'recording' ? (
          <button type="button" className="btn recording" onClick={asr.stop}>
            <Icon name="stop" className="glyph" /> Listo
          </button>
        ) : (
          <button
            type="button"
            className="btn secondary"
            disabled={asr.state === 'transcribing'}
            onClick={() =>
              asr
                .record(MISSION_RECORDING_MS)
                .then(onChange)
                .catch(() => undefined)
            }
          >
            <Icon name="mic" className="glyph" /> {value ? 'Grabar de nuevo' : 'Grabar'}
          </button>
        )}
      </div>
      {asr.state === 'recording' && <p className="muted small">Grabando… hablá tranquilo y tocá «Listo» (corta solo al minuto).</p>}
      {asr.state === 'transcribing' && <p className="muted small">Pasando lo que dijiste a texto…</p>}
      {value && (
        <p className="small">
          Se entendió: <span className="en">«{value}»</span>
        </p>
      )}
      {asr.error && <p className="error small">{asr.error}</p>}
    </div>
  )
}

function MissionResult({ view, onRetry }: { view: MissionView; onRetry: () => void }): React.JSX.Element {
  const review = view.review!
  return (
    <div className={`feedback ${review.passed ? 'ok' : 'bad'}`} role="status">
      <p className="feedback-title">
        {review.passed ? '¡Misión cumplida!' : 'Todavía no'} · {review.percent} %
      </p>
      <ul className="mistakes">
        {review.criteria.map((c, i) => (
          <li key={i}>
            <strong>
              {c.criterion}: {c.score}/3
            </strong>{' '}
            — {c.comment}
          </li>
        ))}
      </ul>
      <p>{review.comments}</p>
      {review.correctedText && (
        <div>
          <span className="level">VERSIÓN CORREGIDA</span>
          <p className="multiline en">{review.correctedText}</p>
        </div>
      )}
      <p className="muted">
        <strong>Para la próxima:</strong> {review.nextStep}
      </p>
      <div>
        <button className="btn secondary" onClick={onRetry}>
          Mejorarla y volver a entregar
        </button>
      </div>
    </div>
  )
}
