// El cierre del día: el resultado, qué se trabajó, qué pasa al cuaderno y qué vuelve mañana.

import { type PracticeResult } from '@shared/exercises'
import Celebrate from '../Celebrate'

export default function ResultCard({
  result,
  onHome,
  onGames,
  onContinue
}: {
  result: PracticeResult
  onHome: () => void
  onGames: () => void
  onContinue: () => void
}): React.JSX.Element {
  const ratio = result.correct / result.total
  const message =
    ratio >= 0.8
      ? '¡Muy bien! Dominás este tema.'
      : ratio >= 0.5
        ? 'Vas bien encaminado. Repasá los ejercicios donde fallaste.'
        : 'Este tema necesita más práctica. Releé los puntos clave y el resumen.'

  return (
    <section className="card stack celebrate-host">
      <Celebrate active={result.correct === result.total} />
      <h2>{result.purpose === 'recovery' ? 'Recuperaste una falta' : `Terminaste la práctica del día ${result.unitIndex}`}</h2>
      <p className="big">
        {result.correct} de {result.total} correctos
      </p>
      <p>{message}</p>
      <ul className="day-close">
        <li>
          Hoy trabajaste <strong>{result.subtopicTitle}</strong>.
        </li>
        <li>
          {result.newMistakes === 0
            ? 'No hubo errores nuevos para el cuaderno.'
            : result.newMistakes === 1
              ? 'Lo que fallaste pasó al cuaderno de errores: vuelve justo antes de que se te olvide.'
              : `Los ${result.newMistakes} que fallaste pasaron al cuaderno de errores: vuelven justo antes de que se te olviden.`}
        </li>
        {result.dueTomorrow > 0 && <li>Mañana te esperan {result.dueTomorrow === 1 ? 'un repaso' : `${result.dueTomorrow} repasos`}.</li>}
      </ul>
      <p className="muted small">Para cerrar, un juego de dos minutos suelta la mano: la fluidez también se entrena.</p>
      <div className="row">
        <button className="btn" onClick={onHome}>
          Volver al inicio
        </button>
        <button className="btn secondary" onClick={onGames}>
          Un juego rápido
        </button>
        <button className="btn secondary" onClick={onContinue}>
          Seguir practicando
        </button>
      </div>
    </section>
  )
}
