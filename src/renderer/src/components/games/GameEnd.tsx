import { useEffect, useRef, useState } from 'react'
import { GAMES, type GameId, type GameResult } from '@shared/games'
import Celebrate from '../Celebrate'
import CountUp from '../CountUp'
import Icon from '../Icon'
import { announceRewards } from '../../rewardsBus'

// Pantalla final de una partida: guarda el puntaje, muestra el récord y la experiencia ganada.
export default function GameEnd({
  game,
  score,
  summary,
  onAgain,
  onExit
}: {
  game: GameId
  score: number
  summary: string
  onAgain: () => void
  onExit: () => void
}): React.JSX.Element {
  const [result, setResult] = useState<GameResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saved = useRef(false)

  useEffect(() => {
    // En modo estricto React monta dos veces: la partida se guarda una sola.
    if (saved.current) return
    saved.current = true
    window.api
      .finishGame(game, score)
      .then((r) => {
        setResult(r)
        announceRewards()
      })
      .catch((err: Error) => setError(err.message))
  }, [game, score])

  return (
    <section className="card stack game-end fade-in celebrate-host">
      <Celebrate active={result?.record === true} />
      <span className="level">{GAMES[game].title.toUpperCase()}</span>
      <div className="game-score">
        <Icon name={GAMES[game].icon} className="hero-icon" />
        <strong>
          <CountUp value={score} />
        </strong>
        <span className="muted">puntos</span>
      </div>
      <p>{summary}</p>
      {result && (
        <div className="row">
          {result.record && <span className="badge ok">¡Nuevo récord!</span>}
          <span className="badge">Récord: {result.best}</span>
          {result.xp > 0 ? <span className="badge">+{result.xp} XP</span> : <span className="muted small">Por hoy los juegos ya no suman experiencia.</span>}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" onClick={onAgain}>
          Jugar de nuevo
        </button>
        <button className="btn secondary" onClick={onExit}>
          Volver a Juegos
        </button>
      </div>
    </section>
  )
}
