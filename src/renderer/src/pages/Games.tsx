import { useCallback, useEffect, useState } from 'react'
import { GAME_IDS, GAMES, GAMES_WITH_XP_PER_DAY, type GameDeck, type GameId } from '@shared/games'
import GameEnd from '../components/games/GameEnd'
import { Countdown, Listen, TrueFalse, type GameProps } from '../components/games/QuizGames'
import { Dictation, Hangman, Memory, Scramble } from '../components/games/WordGames'
import { Pronunciation } from '../components/games/Pronunciation'
import Icon from '../components/Icon'
import { INSTALL_VOICE_HELP } from '../components/summaries/SpeechControls'
import { useCourse } from '../hooks/useCourse'
import { useSpeech } from '../hooks/useSpeech'
import PageSkeleton from '../components/Skeleton'

const COMPONENTS: Record<GameId, (props: GameProps) => React.JSX.Element> = {
  contrarreloj: Countdown,
  escucha: Listen,
  desordenadas: Scramble,
  memotest: Memory,
  ahorcado: Hangman,
  verdadero: TrueFalse,
  dictado: Dictation,
  pronunciacion: Pronunciation
}

// Lo mínimo que necesita cada juego para armarse con lo visto.
function missing(game: GameId, deck: GameDeck): string | null {
  if (game === 'verdadero') return deck.mistakes.length >= 4 ? null : 'Todavía no hay suficientes errores típicos en los tópicos que viste.'
  return deck.phrases.length >= 6 ? null : 'Todavía no hay suficientes frases en los tópicos que viste.'
}

// Juegos para practicar sin esperar a Claude, con las frases y los errores típicos de lo que ya viste.
export default function Games(): React.JSX.Element {
  const course = useCourse()
  const speech = useSpeech()
  const [deck, setDeck] = useState<GameDeck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<GameId | null>(null)
  const [round, setRound] = useState(0)
  const [ended, setEnded] = useState<{ score: number; summary: string } | null>(null)

  const load = useCallback(() => {
    window.api
      .getGameDeck()
      .then(setDeck)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  const onEnd = useCallback((score: number, summary: string) => setEnded({ score, summary }), [])

  if (error) return <p className="error">{error}</p>
  if (!deck) return <PageSkeleton cards={3} />

  if (playing) {
    const Game = COMPONENTS[playing]
    return (
      <>
        <div className="row spread">
          <h1>{GAMES[playing].title}</h1>
          {!ended && (
            <button
              className="btn secondary"
              onClick={() => {
                speech.stop()
                setPlaying(null)
              }}
            >
              Salir
            </button>
          )}
        </div>
        {ended ? (
          <GameEnd
            key={round}
            game={playing}
            score={ended.score}
            summary={ended.summary}
            onAgain={() => {
              setEnded(null)
              setRound((r) => r + 1)
            }}
            onExit={() => {
              setEnded(null)
              setPlaying(null)
              load()
            }}
          />
        ) : (
          <Game key={round} deck={deck} onEnd={onEnd} />
        )}
      </>
    )
  }

  return (
    <>
      <h1>Juegos</h1>
      <p className="muted">
        Para practicar {course.name} cuando quieras, con las frases y los errores típicos de los tópicos que ya viste. No usan a Claude, así que
        empiezan al instante. Las primeras {GAMES_WITH_XP_PER_DAY} partidas de cada día suman experiencia
        {deck.xpGamesLeft < GAMES_WITH_XP_PER_DAY ? ` (hoy te quedan ${deck.xpGamesLeft})` : ''}.
      </p>
      <div className="games-grid">
        {GAME_IDS.map((game) => {
          const info = GAMES[game]
          const record = deck.records[game]
          const reason =
            missing(game, deck) ??
            (info.needsVoice && !speech.hasTarget ? `Necesita una voz de ${course.label} instalada. ${INSTALL_VOICE_HELP}` : null)
          return (
            <section key={game} className="card stack game-card fade-in">
              <div className="game-card-head">
                <Icon name={info.icon} className="game-icon" />
                <div>
                  <h2>{info.title}</h2>
                  <span className="muted small">{record.plays > 0 ? `Récord ${record.best} · ${record.plays} partidas` : 'Sin jugar todavía'}</span>
                </div>
              </div>
              <p className="muted small">{info.description}</p>
              {reason ? (
                <p className="muted small">{reason}</p>
              ) : (
                <div>
                  <button
                    className="btn"
                    onClick={() => {
                      setRound((r) => r + 1)
                      setPlaying(game)
                    }}
                  >
                    Jugar
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
