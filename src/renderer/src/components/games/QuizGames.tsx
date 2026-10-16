import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameDeck, GamePhrase } from '@shared/games'
import { useSpeech } from '../../hooks/useSpeech'
import Icon from '../Icon'
import { choices, sample, unique } from '@shared/game-kit'

export interface GameProps {
  deck: GameDeck
  onEnd: (score: number, summary: string) => void
}

const phraseKey = (p: GamePhrase): string => p.target

// Contrarreloj: un minuto para elegir la traducción de todas las frases posibles. Un error resta 3 segundos.
const DURATION_MS = 60_000
const PENALTY_MS = 3_000

export function Countdown({ deck, onEnd }: GameProps): React.JSX.Element {
  const phrases = useMemo(() => unique(deck.phrases, phraseKey), [deck])
  const [question, setQuestion] = useState(() => makeQuestion(phrases))
  const [left, setLeft] = useState(DURATION_MS)
  const [score, setScore] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const deadline = useRef(Date.now() + DURATION_MS)
  const ended = useRef(false)
  const result = useRef({ score: 0, wrong: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, deadline.current - Date.now())
      setLeft(remaining)
      if (remaining === 0 && !ended.current) {
        ended.current = true
        clearInterval(timer)
        const { score, wrong } = result.current
        onEnd(score, `Tradujiste ${score} ${score === 1 ? 'frase' : 'frases'} en un minuto${wrong ? ` y te equivocaste en ${wrong}` : ''}.`)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [onEnd])

  const choose = (index: number): void => {
    if (ended.current) return
    if (index === question.answer) {
      result.current.score++
      setScore(result.current.score)
      setFlash('ok')
    } else {
      result.current.wrong++
      deadline.current -= PENALTY_MS
      setFlash('bad')
    }
    setQuestion(makeQuestion(phrases, question.phrase))
    setTimeout(() => setFlash(null), 250)
  }

  return (
    <section className={`card stack game-board${flash ? ` flash-${flash}` : ''}`}>
      <div className="game-hud">
        <span className="badge">{score} puntos</span>
        <div className="timer" aria-label={`Quedan ${Math.ceil(left / 1000)} segundos`}>
          <span style={{ width: `${(left / DURATION_MS) * 100}%` }} />
        </div>
        <span className="mono">{Math.ceil(left / 1000)} s</span>
      </div>
      <p className="muted small">¿Cómo se dice?</p>
      <p className="game-prompt">{question.phrase.es}</p>
      <div className="options">
        {question.options.map((option, i) => (
          <button key={`${question.phrase.target}-${i}`} type="button" className="option" onClick={() => choose(i)}>
            {option.target}
          </button>
        ))}
      </div>
    </section>
  )
}

function makeQuestion(phrases: GamePhrase[], previous?: GamePhrase): { phrase: GamePhrase; options: GamePhrase[]; answer: number } {
  const pool = phrases.length > 1 && previous ? phrases.filter((p) => p !== previous) : phrases
  const phrase = sample(pool, 1)[0]
  const { options, answer } = choices(phrase, phrases, 4, phraseKey)
  return { phrase, options, answer }
}

// Escuchá y elegí: suena una frase en el idioma del curso y hay que elegir qué significa.
const LISTEN_ROUNDS = 8

export function Listen({ deck, onEnd }: GameProps): React.JSX.Element {
  const speech = useSpeech()
  const rounds = useMemo(() => {
    const phrases = unique(deck.phrases, phraseKey)
    return sample(phrases, LISTEN_ROUNDS).map((phrase) => ({ phrase, ...choices(phrase, phrases, 4, (p) => p.es) }))
  }, [deck])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const right = useRef(0)
  const round = rounds[index]

  useEffect(() => {
    // Cada frase suena sola al aparecer.
    const timer = setTimeout(() => speech.speakAs(round.phrase.target), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const next = (): void => {
    if (index + 1 >= rounds.length) {
      onEnd(Math.round((right.current / rounds.length) * 100), `Entendiste ${right.current} de ${rounds.length} frases.`)
      return
    }
    setIndex(index + 1)
    setPicked(null)
  }

  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
        <span className="muted small">{right.current} bien</span>
      </div>
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(round.phrase.target)}>
          <Icon name="play" className="glyph" /> Escuchar de nuevo
        </button>
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(round.phrase.target, undefined, true)}>
          Más despacio
        </button>
      </div>
      <div className="options">
        {round.options.map((option, i) => {
          const state = picked === null ? '' : i === round.answer ? ' correct' : i === picked ? ' wrong' : ''
          return (
            <button
              key={i}
              type="button"
              className={`option${state}`}
              disabled={picked !== null}
              onClick={() => {
                setPicked(i)
                if (i === round.answer) right.current++
              }}
            >
              {option.es}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className="stack-sm fade-in">
          <p className="en">{round.phrase.target}</p>
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

// ¿Está bien?: frases con y sin los errores típicos; hay que decidir si están bien.
const TRUE_FALSE_ROUNDS = 10

export function TrueFalse({ deck, onEnd }: GameProps): React.JSX.Element {
  const rounds = useMemo(
    () =>
      sample(
        unique(deck.mistakes, (m) => m.wrong),
        TRUE_FALSE_ROUNDS
      ).map((mistake) => ({ mistake, correct: Math.random() < 0.5 })),
    [deck]
  )
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<boolean | null>(null)
  const right = useRef(0)
  const round = rounds[index]
  const sentence = round.correct ? round.mistake.right : round.mistake.wrong

  const answer = (saysCorrect: boolean): void => {
    setPicked(saysCorrect)
    if (saysCorrect === round.correct) right.current++
  }

  const next = (): void => {
    if (index + 1 >= rounds.length) {
      onEnd(right.current * 10, `Acertaste ${right.current} de ${rounds.length}.`)
      return
    }
    setIndex(index + 1)
    setPicked(null)
  }

  const hit = picked !== null && picked === round.correct
  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
        <span className="muted small">{right.current} bien</span>
      </div>
      <p className="muted small">¿Esta frase está bien escrita?</p>
      <p className="game-prompt en">{sentence}</p>
      {picked === null ? (
        <div className="row">
          <button className="btn" onClick={() => answer(true)}>
            <Icon name="check" className="glyph" /> Está bien
          </button>
          <button className="btn secondary" onClick={() => answer(false)}>
            <Icon name="cross" className="glyph" /> Tiene un error
          </button>
        </div>
      ) : (
        <div className={`feedback ${hit ? 'ok' : 'bad'} fade-in`} role="status">
          <p className="feedback-title">{hit ? '¡Bien!' : 'No'}</p>
          <p>
            {round.correct ? 'Estaba bien.' : 'Tenía un error.'} Lo correcto: <span className="en">{round.mistake.right}</span>
          </p>
          <p className="muted small">{round.mistake.why}</p>
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
