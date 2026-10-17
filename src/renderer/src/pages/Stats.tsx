import { useEffect, useState } from 'react'
import { SKILL_LABELS } from '@shared/curriculum'
import { formatDayMonth, isoWeekday } from '@shared/dates'
import type { StatsView } from '@shared/stats'
import PageSkeleton from '../components/Skeleton'

// Estadísticas: aciertos por habilidad y por tópico, constancia y notas en el tiempo.
export default function Stats(): React.JSX.Element {
  const [stats, setStats] = useState<StatsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getStats()
      .then(setStats)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!stats) return <PageSkeleton cards={3} />

  const empty = stats.totals.answered === 0 && stats.exams.length === 0
  return (
    <>
      <h1>Estadísticas</h1>
      <section className="card stack fade-in">
        <div className="review-stats stats-totals">
          <Total value={stats.totals.answered} label="ejercicios respondidos" />
          <Total value={stats.totals.accuracy === null ? '—' : `${stats.totals.accuracy} %`} label="de aciertos" />
          <Total value={stats.totals.studyDays} label="días con actividad (6 meses)" />
        </div>
        {empty && <p className="muted small">Cuando empieces a practicar, acá vas a ver cómo te va en cada habilidad y en cada tópico.</p>}
      </section>

      <section className="card stack fade-in">
        <h2>Días de estudio</h2>
        <Heatmap activity={stats.activity} />
      </section>

      <div className="stats-grid">
        <section className="card stack fade-in">
          <h2>Por habilidad</h2>
          {stats.skills.map((s) => (
            <div key={s.skill} className="skill-bar">
              <div className="row spread">
                <span>{SKILL_LABELS[s.skill]}</span>
                <span className="muted small">
                  {s.accuracy === null ? 'sin datos' : `${s.accuracy} %`}
                  {s.recentAccuracy !== null && s.accuracy !== null && s.recentAccuracy !== s.accuracy && (
                    <span className={s.recentAccuracy > s.accuracy ? 'trend up' : 'trend down'}>
                      {' '}
                      · último mes {s.recentAccuracy} %
                    </span>
                  )}
                </span>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${s.accuracy ?? 0}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section className="card stack fade-in">
          <h2>Prácticas por semana</h2>
          <WeeksChart weeks={stats.weeks} />
        </section>
      </div>

      {stats.exams.length > 0 && (
        <section className="card stack fade-in">
          <h2>Notas de los exámenes</h2>
          <GradesChart exams={stats.exams} />
        </section>
      )}

      {stats.topics.length > 0 && (
        <section className="card stack fade-in">
          <h2>Por tópico</h2>
          <div className="table-scroll">
            <table className="history">
              <thead>
                <tr>
                  <th>Tópico</th>
                  <th>Respuestas</th>
                  <th>Aciertos</th>
                  <th>Mejor examen</th>
                </tr>
              </thead>
              <tbody>
                {stats.topics.map((t) => (
                  <tr key={t.topicId}>
                    <td>
                      <span className="level-code">{t.level}</span> {t.title}
                    </td>
                    <td>{t.answered}</td>
                    <td className={t.accuracy !== null && t.accuracy < 60 ? 'warn-text' : undefined}>{t.accuracy === null ? '—' : `${t.accuracy} %`}</td>
                    <td>{t.bestGrade ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function Total({ value, label }: { value: number | string; label: string }): React.JSX.Element {
  return (
    <div className="review-stat">
      <strong>{value}</strong>
      <span className="muted small">{label}</span>
    </div>
  )
}

// Mapa de calor: una columna por semana, de lunes a domingo.
function Heatmap({ activity }: { activity: StatsView['activity'] }): React.JSX.Element {
  const max = Math.max(1, ...activity.map((a) => a.count))
  // Se completa la primera semana para que las filas sean siempre lunes a domingo.
  const padding = isoWeekday(activity[0].date) - 1
  const cells = [...Array.from({ length: padding }, () => null), ...activity]
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label="Actividad de los últimos seis meses">
        {cells.map((day, i) =>
          day ? (
            <span
              key={day.date}
              className="heat"
              data-level={day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / max) * 4))}
              title={`${formatDayMonth(day.date)}: ${day.count} ${day.count === 1 ? 'actividad' : 'actividades'}`}
            />
          ) : (
            <span key={`pad-${i}`} className="heat pad" />
          )
        )}
      </div>
      <div className="heat-legend muted small">
        Menos <span className="heat" data-level={0} /> <span className="heat" data-level={1} /> <span className="heat" data-level={2} />{' '}
        <span className="heat" data-level={3} /> <span className="heat" data-level={4} /> Más
      </div>
    </div>
  )
}

function WeeksChart({ weeks }: { weeks: StatsView['weeks'] }): React.JSX.Element {
  const max = Math.max(5, ...weeks.map((w) => w.practices))
  return (
    <div className="bars" role="img" aria-label="Prácticas por semana en las últimas 12 semanas">
      {weeks.map((w) => (
        <div key={w.weekStart} className="bar" title={`Semana del ${formatDayMonth(w.weekStart)}: ${w.practices}`}>
          <span className="bar-fill" style={{ height: `${(w.practices / max) * 100}%` }} />
          <span className="bar-label">{formatDayMonth(w.weekStart).split('/')[0]}</span>
        </div>
      ))}
    </div>
  )
}

// Evolución de las notas: los exámenes semanales en el color del acento, los simulacros más suaves.
function GradesChart({ exams }: { exams: StatsView['exams'] }): React.JSX.Element {
  const width = 600
  const height = 180
  const pad = 24
  const x = (i: number): number => (exams.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (exams.length - 1))
  const y = (grade: number): number => height - pad - (grade / 10) * (height - pad * 2)
  const weekly = exams.map((e, i) => ({ ...e, i })).filter((e) => e.kind === 'weekly')
  return (
    <svg className="grades-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notas de los exámenes">
      <line x1={pad} x2={width - pad} y1={y(8)} y2={y(8)} className="pass-line" />
      <text x={width - pad} y={y(8) - 6} className="chart-note" textAnchor="end">
        aprobado: 8
      </text>
      {weekly.length > 1 && <polyline points={weekly.map((e) => `${x(e.i)},${y(e.grade)}`).join(' ')} className="grade-line" />}
      {exams.map((e, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(e.grade)} r={e.kind === 'weekly' ? 5 : 3.5} className={`grade-dot ${e.kind}${e.passed ? '' : ' failed'}`}>
            <title>{`${e.kind === 'weekly' ? 'Examen' : 'Simulacro'} del ${formatDayMonth(e.date)}: ${e.grade}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  )
}
