import { useMemo, useRef, useState } from 'react'
import { sample, scoreDictation, unique } from '@shared/game-kit'
import { useCourse } from '../../hooks/useCourse'
import { useSpeech } from '../../hooks/useSpeech'
import { useTranscriber } from '../../speech/useTranscriber'
import Icon from '../Icon'
import type { GameProps } from './QuizGames'

const ROUNDS = 5

// Pronunciación: se graba una frase y un reconocimiento de voz que corre en la computadora (Whisper)
// dice qué entendió. Si entiende lo que querías decir, la pronunciación se entiende.
export function Pronunciation({ deck, onEnd }: GameProps): React.JSX.Element {
  const course = useCourse()
  const speech = useSpeech()
  const asr = useTranscriber(course.id)
  const rounds = useMemo(
    () =>
      sample(
        unique(deck.phrases, (p) => p.target).filter((p) => p.target.split(/\s+/).length <= 8),
        ROUNDS
      ),
    [deck]
  )
  const [index, setIndex] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const best = useRef<number[]>([])
  const round = rounds[index]
  const result = heard === null ? null : scoreDictation(heard, round.target)

  if (asr.state === 'idle' || asr.state === 'loading' || (asr.state === 'error' && heard === null && best.current.length === 0)) {
    const percent = asr.progress && asr.progress.total > 0 ? Math.round((asr.progress.loaded / asr.progress.total) * 100) : 0
    return (
      <section className="card stack game-board">
        <span className="level">EXPERIMENTAL</span>
        <h2>Reconocimiento de voz en tu computadora</h2>
        <p className="muted">
          Grabás una frase y Whisper, un reconocimiento de voz que corre acá mismo, te dice qué entendió. La primera vez se baja el modelo (unos 80
          MB) y después funciona sin internet. Lo que grabás no sale de la computadora.
        </p>
        {asr.state === 'loading' ? (
          <div className="stack-sm">
            <div className="timer" aria-label={`Descargando: ${percent} %`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="muted small">
              {percent > 0 && percent < 100 ? `Descargando el modelo: ${percent} %` : 'Preparando el reconocimiento…'}
            </span>
          </div>
        ) : (
          <div>
            <button className="btn" onClick={asr.load}>
              Preparar el reconocimiento
            </button>
          </div>
        )}
        {asr.error && <p className="error multiline">{asr.error}</p>}
      </section>
    )
  }

  const next = (): void => {
    best.current[index] = Math.max(best.current[index] ?? 0, result?.score ?? 0)
    if (index + 1 >= rounds.length) {
      const average = Math.round(best.current.reduce((a, b) => a + b, 0) / rounds.length)
      onEnd(average, `Te entendió el ${average} % de las palabras, en promedio.`)
      return
    }
    setIndex(index + 1)
    setHeard(null)
  }

  const recordNow = (): void => {
    setHeard(null)
    asr
      .record()
      .then(setHeard)
      .catch(() => undefined)
  }

  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
      </div>
      <p className="game-prompt en">{round.target}</p>
      <p className="muted small">{round.es}</p>
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(round.target)}>
          <Icon name="play" className="glyph" /> Escuchar cómo se dice
        </button>
        {asr.state === 'recording' ? (
          <button type="button" className="btn recording" onClick={asr.stop}>
            <Icon name="stop" className="glyph" /> Listo, detener
          </button>
        ) : (
          <button type="button" className="btn" disabled={asr.state === 'transcribing'} onClick={recordNow}>
            <Icon name="mic" className="glyph" /> {heard === null ? 'Grabar' : 'Grabar de nuevo'}
          </button>
        )}
      </div>
      {asr.state === 'recording' && <p className="muted small">Grabando… decí la frase y tocá «Listo» (corta sola a los 8 segundos).</p>}
      {asr.state === 'transcribing' && <p className="muted small">Escuchando lo que grabaste…</p>}
      {asr.error && <p className="error small">{asr.error}</p>}
      {result && (
        <div className="stack-sm fade-in">
          <p className="small">
            Entendió: <span className="en">«{heard || '…'}»</span>
          </p>
          <p className="dictation-marks">
            {result.marks.map((m, i) => (
              <span key={i} className={`mark ${m.ok}`}>
                {m.word}
              </span>
            ))}
          </p>
          <p className="muted small">
            {result.score} % de las palabras. {result.score >= 80 ? '¡Muy bien!' : 'Escuchá el modelo y probá de nuevo, más despacio.'}
          </p>
          <div>
            <button className="btn" onClick={next}>
              {index + 1 < rounds.length ? 'Siguiente' : 'Ver resultado'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
