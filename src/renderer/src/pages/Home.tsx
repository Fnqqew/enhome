import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth, weekdayName } from '@shared/dates'
import type { PracticeUnitView, ProgressState } from '@shared/progress'
import CurriculumOverview from '../components/CurriculumOverview'
import DevTools from '../components/DevTools'
import PlacementFlow from '../components/PlacementFlow'
import WeekCalendar from '../components/WeekCalendar'

export default function Home(): React.JSX.Element {
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDev, setIsDev] = useState(false)

  const reload = useCallback(() => {
    window.api
      .getProgress()
      .then((p) => {
        setProgress(p)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    reload()
    window.api.getAppInfo().then((info) => setIsDev(info.isDev))
  }, [reload])

  return (
    <>
      <h1>Inicio</h1>
      {error && (
        <section className="card">
          <p className="error multiline">{error}</p>
        </section>
      )}
      {progress && !progress.placementDone && <PlacementFlow resume={progress.placementInProgress} onDone={reload} />}
      {progress?.placementDone && <Journey progress={progress} />}
      {isDev && progress && <DevTools progress={progress} onChange={setProgress} />}
      <CurriculumOverview />
    </>
  )
}

function unitNote(unit: PracticeUnitView, weekTopicId: string): string | null {
  if (unit.kind === 'focus') return 'refuerzo de lo que fallaste'
  if (unit.kind === 'review') return unit.topicId === weekTopicId ? 'repaso' : `repaso de ${unit.topicTitle}`
  return null
}

function Journey({ progress }: { progress: ProgressState }): React.JSX.Element {
  const { week } = progress

  if (progress.finished) {
    return (
      <section className="card stack">
        <h2>¡Completaste todo el temario disponible!</h2>
        <p className="muted">Cuando se sumen nuevos niveles, tu recorrido sigue desde acá.</p>
      </section>
    )
  }
  if (!week) {
    return (
      <section className="card">
        <p className="muted">Preparando tu próxima semana…</p>
      </section>
    )
  }

  const upcoming = progress.today < week.startsOn
  const note = week.nextUnit ? unitNote(week.nextUnit, week.topicId) : null
  const examTone = week.examStatus === 'available' ? ' ok' : week.examStatus === 'locked' ? ' warn' : ''

  return (
    <>
      <section className="card stack">
        <div className="card-header">
          <div>
            <span className="level">
              {week.level} · SEMANA DEL {formatDayMonth(week.weekStart)}
            </span>
            <h2>{week.topicTitle}</h2>
          </div>
          {week.kind !== 'normal' && <span className="badge">{week.kind === 'carry' ? 'Continuación' : 'Reintento'}</span>}
        </div>

        {upcoming && (
          <div className="notice">
            Tu semana empieza el {weekdayName(week.startsOn)} {formatDayMonth(week.startsOn)}. Mientras tanto podés leer los
            resúmenes y repasar libremente.
          </div>
        )}

        <WeekCalendar days={week.days} today={progress.today} />

        <div className="stats">
          <span>
            Prácticas <strong>{week.completedUnits}/{week.units.length}</strong>
          </span>
          <span>
            Faltas <strong>{week.effectiveFaltas}</strong>
            {week.recovered && <span className="muted"> (1 recuperada)</span>}
          </span>
          {progress.attempts && progress.attempts.attempts > 0 && (
            <span>
              Intentos de examen <strong>{progress.attempts.attempts}</strong>
            </span>
          )}
        </div>

        <div>
          <h3 className="level">PRÁCTICA</h3>
          {week.nextUnit ? (
            <p>
              Próxima: <strong>Día {week.nextUnit.index} — {week.nextUnit.subtopicTitle}</strong>
              {note && <span className="muted"> ({note})</span>}
            </p>
          ) : (
            <p>Completaste todas las prácticas de la semana.</p>
          )}
          {week.nextUnit && !week.canPracticeNow && week.practiceBlockedReason && (
            <p className="muted">{week.practiceBlockedReason}</p>
          )}
          <p className="muted">Los ejercicios llegan en la fase 4.</p>
        </div>

        {week.canRecover && <div className="notice">Hoy es domingo: si practicás, recuperás una falta.</div>}

        <div className={`notice${examTone}`}>
          <strong>Examen:</strong> {week.examMessage}
        </div>
      </section>

      {progress.reviewTopics.length > 0 && (
        <section className="card stack">
          <h2>Repasos recomendados</h2>
          <p className="muted">Detectamos errores en tópicos anteriores. Conviene repasarlos:</p>
          <ul>
            {progress.reviewTopics.map((t) => (
              <li key={t.id}>
                {t.title} <span className="muted">({t.level})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
