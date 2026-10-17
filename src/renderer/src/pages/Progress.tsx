import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth } from '@shared/dates'
import type { CalendarDayStatus, ProgressView } from '@shared/rewards'
import CountUp from '../components/CountUp'
import Icon from '../components/Icon'
import Certificates from '../components/progress/Certificates'
import RoadMap from '../components/progress/RoadMap'
import { JourneyBar } from '../components/progress/Charts'
import { useDayChange } from '../hooks/useDay'
import type { Navigate } from '../navigation'
import { SkeletonCard } from '../components/Skeleton'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const CALENDAR_LABEL: Record<CalendarDayStatus, string> = {
  done: 'Practicaste',
  missed: 'Falta',
  protected: 'Protegido con comodín',
  today: 'Hoy',
  rest: 'Descanso',
  none: 'Sin semana activa',
  future: ''
}

const percent = (current: number, total: number): string => `${total > 0 ? Math.min(100, (current / total) * 100) : 0}%`

export default function Progress({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [view, setView] = useState<ProgressView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getProgressView()
      .then(setView)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])
  useDayChange(load)

  if (!view) {
    return (
      <>
        <h1>Progreso</h1>
        {error ? <p className="error">{error}</p> : <SkeletonCard lines={4} />}
      </>
    )
  }

  const { player, stats } = view
  const unlockedCount = view.achievements.filter((a) => a.unlockedAt).length
  const achievements = [...view.achievements].sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))

  return (
    <>
      <h1>Progreso</h1>

      <section className="card wide hero">
        <div className="hero-level">
          <span className="hero-level-number">
            <CountUp value={player.level} from={Math.max(1, player.level - 1)} />
          </span>
          <span className="small">nivel</span>
        </div>
        <div className="hero-body stack-sm">
          <h2>{player.title}</h2>
          <div className="xp-bar" aria-label={`${player.xpIntoLevel} de ${player.xpForNextLevel} de experiencia`}>
            <span style={{ width: percent(player.xpIntoLevel, player.xpForNextLevel) }} />
          </div>
          <span className="muted small">
            <CountUp value={player.xpIntoLevel} /> / {player.xpForNextLevel} XP para el nivel {player.level + 1} · <CountUp value={player.xp} /> XP en
            total
          </span>
        </div>
        <div className="hero-streak">
          <span className="streak-flame" aria-hidden>
            <Icon name="flame" className="glyph" />
          </span>
          <span className="streak-count">
            <CountUp value={player.streak} />
          </span>
          <span className="small">{player.streak === 1 ? 'día de racha' : 'días de racha'}</span>
          <span className="muted small">
            Mejor: {player.bestStreak} · ×{player.multiplier.toLocaleString('es-AR')} XP
          </span>
        </div>
      </section>

      <section className="card wide stack">
        <div className="card-header">
          <h2>Tu racha</h2>
          <span className="muted small">Los días hábiles con práctica suman; el fin de semana no corta.</span>
        </div>
        <div className="streak-calendar">
          {WEEKDAYS.map((d, i) => (
            <span key={`h${i}`} className="streak-head">
              {d}
            </span>
          ))}
          {view.calendar.map((day) => (
            <span
              key={day.date}
              className={`streak-cell ${day.status}`}
              title={`${formatDayMonth(day.date)}${CALENDAR_LABEL[day.status] ? ` · ${CALENDAR_LABEL[day.status]}` : ''}`}
            >
              {Number(day.date.slice(8))}
            </span>
          ))}
        </div>
        <div className="legend">
          <span>
            <i className="streak-cell done" /> Practicaste
          </span>
          <span>
            <i className="streak-cell missed" /> Falta
          </span>
          <span>
            <i className="streak-cell protected" /> Protegido
          </span>
          <span>
            <i className="streak-cell rest" /> Descanso
          </span>
        </div>
      </section>

      <section className="card wide stack">
        <h2>Comodines</h2>
        <div className="powerups">
          {view.inventory.map((item) => (
            <div key={item.id} className={`powerup${item.quantity > 0 ? ' has' : ''}`}>
              <span className="powerup-icon" aria-hidden>
                <Icon name={item.icon} className="glyph" />
              </span>
              <div className="stack-sm">
                <strong>
                  {item.label} <span className="muted">
                    {item.quantity}/{item.max}
                  </span>
                </strong>
                <span className="small">{item.description}</span>
                <span className="muted small">Se gana: {item.howToEarn}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card wide stack">
        <div className="card-header">
          <h2>Logros</h2>
          <span className="muted">
            {unlockedCount} de {view.achievements.length}
          </span>
        </div>
        <div className="achievements">
          {achievements.map((a) => (
            <div key={a.id} className={`achievement${a.unlockedAt ? ' unlocked' : ''}`} title={a.description}>
              <span className="achievement-icon" aria-hidden>
                <Icon name={a.icon} className="glyph" />
              </span>
              <strong className="small">{a.title}</strong>
              <span className="muted small">{a.description}</span>
              {!a.unlockedAt && a.target > 1 && (
                <div className="mini-progress" aria-label={`${a.current} de ${a.target}`}>
                  <span style={{ width: percent(a.current, a.target) }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card wide stack">
        <div className="card-header">
          <h2>Tu recorrido</h2>
          <div className="row">
            <button className="chip" onClick={() => navigate('estadisticas')}>
              Ver estadísticas
            </button>
            <button className="chip" onClick={() => navigate('temario')}>
              Ver temario
            </button>
          </div>
        </div>
        <JourneyBar map={view.map} />
        <RoadMap map={view.map} />
      </section>

      <section className="card wide stack">
        <h2>Números</h2>
        <div className="stat-grid">
          <Stat value={stats.practices} label="prácticas completas" />
          <Stat value={stats.exercisesAnswered} label="ejercicios respondidos" />
          <Stat value={stats.accuracy === null ? '—' : `${stats.accuracy} %`} label="de aciertos" />
          <Stat value={stats.weeklyPassed} label="exámenes aprobados" />
          <Stat value={stats.averageGrade ?? '—'} label="nota promedio" />
          <Stat value={stats.mocks} label="simulacros" />
        </div>
        {view.recentXp.length > 0 && (
          <div>
            <h3 className="level">ÚLTIMA EXPERIENCIA</h3>
            <ul className="xp-list">
              {view.recentXp.map((item, i) => (
                <li key={i}>
                  <span>
                    {item.label} <span className="muted small">· {formatDayMonth(item.date)}</span>
                  </span>
                  <strong>+{item.amount} XP</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Certificates />
    </>
  )
}

function Stat({ value, label }: { value: number | string; label: string }): React.JSX.Element {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="muted small">{label}</span>
    </div>
  )
}
