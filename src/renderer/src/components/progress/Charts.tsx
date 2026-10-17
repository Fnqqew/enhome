import type { CurriculumMap } from '@shared/curriculum'

// Anillo de la semana: cuántas de las cinco prácticas van hechas.
export function WeekRing({ done, total }: { done: number; total: number }): React.JSX.Element {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const ratio = total > 0 ? done / total : 0
  return (
    <svg className="week-ring" viewBox="0 0 64 64" role="img" aria-label={`${done} de ${total} prácticas de la semana`}>
      <circle cx="32" cy="32" r={radius} className="ring-track" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        className="ring-fill"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="ring-text">
        {done}/{total}
      </text>
    </svg>
  )
}

// El recorrido A1 → C1: un tramo por nivel con lo aprobado, y el nivel en curso marcado.
export function JourneyBar({ map }: { map: CurriculumMap }): React.JSX.Element {
  const levels = map.levels.filter((l) => l.topics.length > 0)
  const total = levels.reduce((sum, l) => sum + l.topics.length, 0)
  const passed = levels.reduce((sum, l) => sum + l.topics.filter((t) => t.status === 'passed' || t.status === 'review').length, 0)
  return (
    <div className="journey" aria-label={`Recorrido: ${passed} de ${total} tópicos aprobados`}>
      <div className="journey-bar">
        {levels.map((level) => {
          const done = level.topics.filter((t) => t.status === 'passed' || t.status === 'review').length
          const current = level.topics.some((t) => t.status === 'current')
          return (
            <div key={level.level} className={`journey-segment${current ? ' current' : ''}`} style={{ flexGrow: level.topics.length }}>
              <span className="journey-fill" style={{ width: `${(done / level.topics.length) * 100}%` }} />
              <span className="journey-label">
                <strong>{level.level}</strong> <span className="muted">{done}/{level.topics.length}</span>
              </span>
            </div>
          )
        })}
      </div>
      <p className="muted small">
        {passed} de {total} tópicos aprobados en todo el curso.
      </p>
    </div>
  )
}
