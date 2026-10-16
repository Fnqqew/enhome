import { useEffect, useMemo, useRef, useState } from 'react'
import type { GamePhrase } from '@shared/games'
import { useSpeech } from '../../hooks/useSpeech'
import Icon from '../Icon'
import type { GameProps } from './QuizGames'
import { normalizeText, sample, scoreDictation, shuffle, unique, withoutAccents } from './kit'

const phraseKey = (p: GamePhrase): string => p.target
const words = (text: string): string[] => text.split(/\s+/).filter(Boolean)

// Frases desordenadas: tocar las palabras en orden para armar la frase.
const SCRAMBLE_ROUNDS = 6

export function Scramble({ deck, onEnd }: GameProps): React.JSX.Element {
  const rounds = useMemo(() => {
    const usable = unique(deck.phrases, phraseKey).filter((p) => words(p.target).length >= 3 && words(p.target).length <= 12)
    return sample(usable, SCRAMBLE_ROUNDS).map((phrase) => {
      const tokens = words(phrase.target)
      let order = shuffle(tokens.map((_, i) => i))
      // Que no salga ya ordenada.
      if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]]
      return { phrase, tokens, order }
    })
  }, [deck])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const right = useRef(0)
  const round = rounds[index]

  const check = (): void => {
    const built = chosen.map((i) => round.tokens[i]).join(' ')
    const ok = normalizeText(built) === normalizeText(round.phrase.target)
    if (ok) right.current++
    setChecked(ok)
  }

  const next = (): void => {
    if (index + 1 >= rounds.length) {
      onEnd(Math.round((right.current / rounds.length) * 100), `Armaste bien ${right.current} de ${rounds.length} frases.`)
      return
    }
    setIndex(index + 1)
    setChosen([])
    setChecked(null)
  }

  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
        <span className="muted small">{right.current} bien</span>
      </div>
      <p className="muted small">Significa: {round.phrase.es}</p>
      <div className={`answer-line${checked === null ? '' : checked ? ' ok' : ' bad'}`}>
        {chosen.length === 0 ? (
          <span className="muted">Tocá las palabras en orden</span>
        ) : (
          chosen.map((tokenIndex, position) => (
            <button
              key={position}
              type="button"
              className="token"
              disabled={checked !== null}
              onClick={() => setChosen(chosen.filter((_, p) => p !== position))}
            >
              {round.tokens[tokenIndex]}
            </button>
          ))
        )}
      </div>
      <div className="token-bank">
        {round.order.map((tokenIndex) =>
          chosen.includes(tokenIndex) ? null : (
            <button key={tokenIndex} type="button" className="token" disabled={checked !== null} onClick={() => setChosen([...chosen, tokenIndex])}>
              {round.tokens[tokenIndex]}
            </button>
          )
        )}
      </div>
      {checked === null ? (
        <div>
          <button className="btn" disabled={chosen.length !== round.tokens.length} onClick={check}>
            Comprobar
          </button>
        </div>
      ) : (
        <div className="stack-sm fade-in">
          {!checked && (
            <p>
              Era: <span className="en">{round.phrase.target}</span>
            </p>
          )}
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

// Memotest: seis pares de frase y traducción, en la menor cantidad de jugadas.
const PAIRS = 6

interface Card {
  id: number
  pair: number
  text: string
  target: boolean
}

export function Memory({ deck, onEnd }: GameProps): React.JSX.Element {
  const cards = useMemo(() => {
    const fromWords = deck.words.map((w) => ({ target: w.term, es: w.translation }))
    const short = unique(deck.phrases, phraseKey).filter((p) => p.target.length <= 32 && p.es.length <= 36)
    const pool = fromWords.length >= PAIRS ? fromWords : [...fromWords, ...short]
    const pairs = sample(
      unique(pool, (p) => p.target),
      PAIRS
    )
    return shuffle(
      pairs.flatMap((p, pair): Card[] => [
        { id: pair * 2, pair, text: p.target, target: true },
        { id: pair * 2 + 1, pair, text: p.es, target: false }
      ])
    )
  }, [deck])
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    if (open.length !== 2) return
    const [a, b] = open.map((id) => cards.find((c) => c.id === id)!)
    const timer = setTimeout(
      () => {
        if (a.pair === b.pair) setFound((f) => [...f, a.pair])
        setOpen([])
      },
      a.pair === b.pair ? 350 : 900
    )
    return () => clearTimeout(timer)
  }, [open, cards])

  useEffect(() => {
    if (found.length === PAIRS && !done.current) {
      done.current = true
      const pairsCount = cards.length / 2
      onEnd(Math.max(10, 100 - (moves - pairsCount) * 6), `Encontraste los ${pairsCount} pares en ${moves} jugadas.`)
    }
  }, [found, moves, cards, onEnd])

  const flip = (card: Card): void => {
    if (open.length === 2 || open.includes(card.id) || found.includes(card.pair)) return
    const next = [...open, card.id]
    setOpen(next)
    if (next.length === 2) setMoves((m) => m + 1)
  }

  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">{moves} jugadas</span>
        <span className="muted small">
          {found.length} / {cards.length / 2} pares
        </span>
      </div>
      <div className="memory-grid">
        {cards.map((card) => {
          const visible = open.includes(card.id) || found.includes(card.pair)
          return (
            <button
              key={card.id}
              type="button"
              className={`memory-card${visible ? ' visible' : ''}${found.includes(card.pair) ? ' found' : ''}`}
              aria-label={visible ? card.text : 'Carta boca abajo'}
              onClick={() => flip(card)}
            >
              <span className={`memory-face${card.target ? ' en' : ''}`}>{visible ? card.text : ''}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Ahorcado: la palabra que falta en una frase, letra por letra. Las tildes no hace falta adivinarlas.
const HANGMAN_WORDS = 3
const LIVES = 6
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

const base = (letter: string): string => withoutAccents(letter.toLowerCase())

export function Hangman({ deck, onEnd }: GameProps): React.JSX.Element {
  const rounds = useMemo(() => {
    const candidates = unique(deck.phrases, phraseKey).flatMap((phrase) => {
      const options = words(phrase.target)
        .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
        // Solo palabras que se puedan armar con el teclado del juego (sin «œ», por ejemplo).
        .filter((w) => w.length >= 5 && /^\p{L}+$/u.test(w) && w.split('').every((l) => LETTERS.includes(base(l))))
      return options.length > 0 ? [{ phrase, word: sample(options, 1)[0] }] : []
    })
    return sample(candidates, HANGMAN_WORDS)
  }, [deck])
  const [index, setIndex] = useState(0)
  const [guessed, setGuessed] = useState<string[]>([])
  const total = useRef(0)
  const solvedCount = useRef(0)
  const round = rounds[index]
  const letters = round.word.split('')
  const misses = guessed.filter((g) => !letters.some((l) => base(l) === g)).length
  const solved = letters.every((l) => guessed.includes(base(l)))
  const lost = misses >= LIVES
  const over = solved || lost

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const key = base(event.key)
      if (key.length === 1 && LETTERS.includes(key)) guess(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const guess = (letter: string): void => {
    if (over || guessed.includes(letter)) return
    setGuessed([...guessed, letter])
  }

  const next = (): void => {
    total.current += solved ? 10 + (LIVES - misses) * 5 : 0
    if (solved) solvedCount.current++
    if (index + 1 >= rounds.length) {
      onEnd(total.current, `Adivinaste ${solvedCount.current} de ${rounds.length} palabras.`)
      return
    }
    setIndex(index + 1)
    setGuessed([])
  }

  const hidden = round.phrase.target.replace(round.word, '＿'.repeat(Math.min(round.word.length, 8)))
  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
        <span className="lives" aria-label={`${LIVES - misses} vidas`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <Icon key={i} name="heart" className={`glyph${i < LIVES - misses ? ' alive' : ''}`} filled={i < LIVES - misses} />
          ))}
        </span>
      </div>
      <p className="en">{hidden}</p>
      <p className="muted small">Significa: {round.phrase.es}</p>
      <p className="hangman-word" aria-label={over ? round.word : `${letters.length} letras`}>
        {letters.map((l, i) => (
          <span key={i} className={guessed.includes(base(l)) || over ? 'shown' : ''}>
            {guessed.includes(base(l)) || over ? l : ''}
          </span>
        ))}
      </p>
      {over ? (
        <div className="stack-sm fade-in">
          <p>{solved ? '¡La sacaste!' : `Era «${round.word}».`}</p>
          <div>
            <button className="btn" onClick={next}>
              {index + 1 < rounds.length ? 'Siguiente' : 'Ver resultado'}
            </button>
          </div>
        </div>
      ) : (
        <div className="keyboard">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`key${guessed.includes(letter) ? (letters.some((l) => base(l) === letter) ? ' hit' : ' miss') : ''}`}
              disabled={guessed.includes(letter)}
              onClick={() => guess(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// Dictado: suena una frase y se escribe tal cual. Una tilde mal vale media palabra.
const DICTATION_ROUNDS = 5

export function Dictation({ deck, onEnd }: GameProps): React.JSX.Element {
  const speech = useSpeech()
  const rounds = useMemo(
    () =>
      sample(
        unique(deck.phrases, phraseKey).filter((p) => words(p.target).length <= 10),
        DICTATION_ROUNDS
      ),
    [deck]
  )
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [result, setResult] = useState<ReturnType<typeof scoreDictation> | null>(null)
  const scores = useRef<number[]>([])
  const round = rounds[index]

  useEffect(() => {
    const timer = setTimeout(() => speech.speakAs(round.target), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const check = (event: React.FormEvent): void => {
    event.preventDefault()
    if (result || !text.trim()) return
    const r = scoreDictation(text, round.target)
    scores.current.push(r.score)
    setResult(r)
  }

  const next = (): void => {
    if (index + 1 >= rounds.length) {
      const average = Math.round(scores.current.reduce((a, b) => a + b, 0) / scores.current.length)
      onEnd(average, `Promedio de aciertos: ${average} %.`)
      return
    }
    setIndex(index + 1)
    setText('')
    setResult(null)
  }

  return (
    <section className="card stack game-board">
      <div className="game-hud">
        <span className="badge">
          {index + 1} / {rounds.length}
        </span>
      </div>
      <div className="row">
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(round.target)}>
          <Icon name="play" className="glyph" /> Escuchar de nuevo
        </button>
        <button type="button" className="btn secondary" onClick={() => speech.speakAs(round.target, undefined, true)}>
          Más despacio
        </button>
      </div>
      <form className="stack" onSubmit={check}>
        <input
          className="text-answer"
          value={text}
          autoFocus
          disabled={result !== null}
          placeholder="Escribí lo que escuchás"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
        {result ? (
          <div className="stack-sm fade-in">
            <p className="dictation-marks">
              {result.marks.map((m, i) => (
                <span key={i} className={`mark ${m.ok}`}>
                  {m.word}
                </span>
              ))}
            </p>
            <p className="muted small">
              {result.score} % · {round.es}
            </p>
            <div>
              <button className="btn" type="button" onClick={next}>
                {index + 1 < rounds.length ? 'Siguiente' : 'Ver resultado'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="btn" type="submit" disabled={!text.trim()}>
              Comprobar
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
