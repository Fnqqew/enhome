// El resultado al terminar la práctica.

import { type PracticeResult } from '@shared/exercises'
import Celebrate from '../Celebrate'

export default function ResultCard({
  result,
  onHome,
  onContinue
}: {
  result: PracticeResult
  onHome: () => void
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
      <div className="row">
        <button className="btn" onClick={onHome}>
          Volver al inicio
        </button>
        <button className="btn secondary" onClick={onContinue}>
          Seguir practicando
        </button>
      </div>
    </section>
  )
}
