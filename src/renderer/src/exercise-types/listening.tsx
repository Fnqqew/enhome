// Escuchar y hablar: el audio se genera en la computadora con la voz del idioma, y lo que dice
// recién se muestra cuando el alumno ya respondió.

import { useEffect, useRef, useState } from 'react'
import { matchedWords } from '@shared/exercise-types/listening'
import type { VoiceRole } from '@shared/voice'
import Icon from '../components/Icon'
import { useCourse } from '../hooks/useCourse'
import { prefetchSpeech, useSpeech } from '../hooks/useSpeech'
import { useTranscriber } from '../speech/useTranscriber'
import { OptionList, QuestionList, resultClass, type ItemProps } from './common'

// Los botones para escuchar (normal y más despacio). Con autoPlay suena una vez al aparecer.
export function Listen({
  text,
  lines,
  label = 'Escuchar',
  autoPlay = false
}: {
  text?: string
  lines?: { text: string; role: VoiceRole }[]
  label?: string
  autoPlay?: boolean
}): React.JSX.Element {
  const course = useCourse()
  const speech = useSpeech()
  const played = useRef(false)
  const key = text ?? lines?.map((l) => l.text).join('|') ?? ''
  const play = (slower: boolean): void => {
    if (speech.state === 'playing') return speech.stop()
    if (lines) speech.speakLines(lines)
    else if (text) speech.speakAs(text, course.id, slower)
  }

  useEffect(() => {
    prefetchSpeech(text ?? '', course.id, lines)
    if (autoPlay && !played.current) {
      played.current = true
      play(false)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const playing = speech.state === 'playing'
  return (
    <div className="row listen">
      <button type="button" className="btn listen-main" onClick={() => play(false)} aria-label={playing ? 'Parar' : label}>
        <Icon name={playing ? 'stop' : 'play'} className="glyph" /> {playing ? 'Parar' : label}
      </button>
      {!lines && (
        <button type="button" className="btn secondary" disabled={playing} onClick={() => play(true)}>
          Más despacio
        </button>
      )}
    </div>
  )
}

export function Dictation({ content, answer, feedback, locked, onChange }: ItemProps<'dictation'>): React.JSX.Element {
  const lang = useCourse().name
  const [text, setText] = useState(answer?.type === 'dictation' ? answer.text : '')
  return (
    <>
      <Listen text={content.audio} autoPlay={!answer} />
      <input
        className={`text-answer${resultClass(feedback)}`}
        value={text}
        disabled={feedback !== null || !!locked}
        placeholder={`Escribí lo que escuchás, en ${lang}`}
        autoFocus
        aria-label="Lo que escuchaste"
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.trim() ? { type: 'dictation', text: e.target.value } : null)
        }}
      />
      {feedback && <p className="muted">Significa: {content.translation}</p>}
    </>
  )
}

export function Listening({ content, answer, feedback, locked, onChange }: ItemProps<'listening'>): React.JSX.Element {
  // La primera persona que habla lleva la voz principal; la otra, la segunda voz del idioma.
  const first = content.lines[0]?.speaker
  const lines = content.lines.map((line) => ({ text: line.text, role: (line.speaker === first ? 'main' : 'other') as VoiceRole }))
  return (
    <>
      <p className="situation">{content.situation}</p>
      <Listen lines={lines} label="Escuchar la charla" />
      <QuestionList
        questions={content.questions}
        initial={answer?.type === 'listening' ? answer.choices : null}
        feedback={feedback}
        locked={feedback !== null || !!locked}
        onAnswer={(choices) => onChange(choices ? { type: 'listening', choices } : null)}
      />
      {feedback && (
        <details className="transcript">
          <summary>Lo que se dijo</summary>
          <div className="chat">
            {content.lines.map((line, i) => (
              <div key={i} className={`chat-line${line.speaker === first ? '' : ' mine'}`}>
                <span className="chat-speaker">{line.speaker}</span>
                <p className="bubble">{line.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  )
}

export function MinimalPair({ content, answer, feedback, locked, onChange }: ItemProps<'minimal_pair'>): React.JSX.Element {
  const course = useCourse()
  const speech = useSpeech()
  const [choice, setChoice] = useState<number | null>(answer?.type === 'minimal_pair' && answer.choice >= 0 ? answer.choice : null)
  // La respuesta correcta llega como «palabra (significado)».
  const correctText = feedback ? (content.pair.find((word) => feedback.correctAnswer?.startsWith(`${word} (`)) ?? null) : null
  return (
    <>
      <Listen text={content.audio} autoPlay={!answer} />
      <p className="muted">¿Cuál de las dos escuchaste?</p>
      <OptionList
        options={content.pair}
        selected={choice}
        correctText={correctText}
        locked={feedback !== null || !!locked}
        onSelect={(i) => {
          setChoice(i)
          onChange({ type: 'minimal_pair', choice: i })
        }}
      />
      {feedback && (
        <div className="row">
          {content.pair.map((word) => (
            <button key={word} type="button" className="chip" onClick={() => speech.speakAs(word, course.id, true)}>
              <Icon name="play" className="glyph" /> {word}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function Shadowing({ content, answer, feedback, locked, onChange }: ItemProps<'shadowing'>): React.JSX.Element {
  const course = useCourse()
  const asr = useTranscriber(course.id)
  const [heard, setHeard] = useState<string | null>(answer?.type === 'shadowing' ? answer.text : null)
  const frozen = feedback !== null || !!locked
  const marks = heard !== null ? matchedWords(content.phrase, heard) : null
  const words = content.phrase.split(/\s+/)
  const percent = asr.progress && asr.progress.total > 0 ? Math.round((asr.progress.loaded / asr.progress.total) * 100) : 0

  const record = (): void => {
    setHeard(null)
    onChange(null)
    asr
      .record()
      .then((text) => {
        setHeard(text)
        onChange({ type: 'shadowing', text })
      })
      .catch(() => undefined)
  }

  return (
    <>
      <p className="prompt en">
        {/* Después de grabar, cada palabra queda marcada según si se entendió. */}
        {marks && marks.length === words.length
          ? words.map((word, i) => (
              <span key={i} className={`mark ${marks[i] ? 'yes' : 'no'}`}>
                {word}{' '}
              </span>
            ))
          : content.phrase}
      </p>
      <p className="muted">{content.translation}</p>
      <Listen text={content.phrase} autoPlay={!answer} />
      <p className="notice with-icon">
        <Icon name="bulb" className="glyph" />
        <span>{content.tip}</span>
      </p>
      {asr.state === 'idle' || asr.state === 'loading' ? (
        <div className="stack-sm">
          <p className="muted small">
            Para escucharte, un reconocimiento de voz corre en tu computadora (lo que grabás no sale de acá). La primera vez se baja el modelo.
          </p>
          {asr.state === 'loading' ? (
            <div className="stack-sm">
              <div className="timer" aria-label={`Descargando: ${percent} %`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <span className="muted small">{percent > 0 && percent < 100 ? `Descargando el modelo: ${percent} %` : 'Preparando…'}</span>
            </div>
          ) : (
            <div>
              <button type="button" className="btn secondary" onClick={asr.load}>
                <Icon name="mic" className="glyph" /> Preparar el micrófono
              </button>
            </div>
          )}
        </div>
      ) : (
        !frozen && (
          <div className="row">
            {asr.state === 'recording' ? (
              <button type="button" className="btn recording" onClick={asr.stop}>
                <Icon name="stop" className="glyph" /> Listo
              </button>
            ) : (
              <button type="button" className="btn" disabled={asr.state === 'transcribing'} onClick={record}>
                <Icon name="mic" className="glyph" /> {heard === null ? 'Grabarme' : 'Grabarme de nuevo'}
              </button>
            )}
          </div>
        )
      )}
      {asr.state === 'recording' && <p className="muted small">Grabando… decí la frase y tocá «Listo».</p>}
      {asr.state === 'transcribing' && <p className="muted small">Escuchando lo que dijiste…</p>}
      {heard !== null && !frozen && <p className="small">Se entendió: «{heard || '…'}»</p>}
      {asr.error && <p className="error small">{asr.error} Si no podés hablar ahora, tocá «Cambiar ejercicio».</p>}
    </>
  )
}
