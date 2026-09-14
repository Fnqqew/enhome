import { useEffect, useState } from 'react'
import { addDays, weekdayName } from '@shared/dates'
import type { ProgressState } from '@shared/progress'

// Solo en desarrollo: simular fechas, prácticas y exámenes hasta que existan los reales.
export default function DevTools({
  progress,
  onChange
}: {
  progress: ProgressState
  onChange: (state: ProgressState) => void
}): React.JSX.Element {
  const [date, setDate] = useState(progress.today)
  const [grade, setGrade] = useState(9)
  const [error, setError] = useState<string | null>(null)
  const { week } = progress

  useEffect(() => setDate(progress.today), [progress.today])

  const run = (action: () => Promise<ProgressState>): void => {
    setError(null)
    action()
      .then(onChange)
      .catch((err: Error) => setError(err.message))
  }

  return (
    <section className="card stack dev">
      <div className="card-header">
        <h2>Herramientas de prueba</h2>
        <span className="muted">solo en desarrollo</span>
      </div>
      <p className="muted">
        Hoy para la app: {weekdayName(progress.today)} {progress.today}
      </p>
      <div className="row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn secondary" onClick={() => run(() => window.api.devSetToday(date))}>
          Usar fecha
        </button>
        <button className="btn secondary" onClick={() => run(() => window.api.devSetToday(addDays(progress.today, 1)))}>
          Día siguiente
        </button>
        <button className="btn secondary" onClick={() => run(() => window.api.devSetToday(null))}>
          Fecha real
        </button>
      </div>
      <div className="row">
        <button
          className="btn secondary"
          disabled={!week?.canPracticeNow}
          onClick={() => week?.nextUnit && run(() => window.api.completePracticeUnit(week.nextUnit!.id))}
        >
          Completar práctica
        </button>
        <button
          className="btn secondary"
          disabled={!week?.canRecover || week.nextUnit !== null}
          onClick={() => run(() => window.api.recordRecoverySession())}
        >
          Repaso de recuperación
        </button>
      </div>
      <div className="row">
        <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
          {[10, 9, 8, 7, 6, 4, 2].map((g) => (
            <option key={g} value={g}>
              Nota {g}
            </option>
          ))}
        </select>
        <button
          className="btn secondary"
          disabled={week?.examStatus !== 'available'}
          onClick={() => run(() => window.api.devSimulateExam(grade))}
        >
          Simular examen
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            if (confirm('¿Borrar todo el progreso y volver al examen inicial?')) run(() => window.api.devResetProgress())
          }}
        >
          Reiniciar progreso
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
