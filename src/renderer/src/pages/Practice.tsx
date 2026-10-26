import { useCallback, useEffect, useState } from 'react'
import { type PracticeResult, type PracticeView } from '@shared/exercises'
import { formatDayMonth, weekdayName } from '@shared/dates'
import { useDayChange } from '../hooks/useDay'
import { type Navigate } from '../navigation'
import { SkeletonCard } from '../components/Skeleton'
import Intro from '../components/practice/Intro'
import SessionPlayer from '../components/practice/SessionPlayer'
import ResultCard from '../components/practice/ResultCard'

export default function Practice({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [view, setView] = useState<PracticeView | null>(null)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const load = useCallback(() => {
    setError(null)
    window.api
      .getPractice()
      .then(setView)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  const [dayNotice, setDayNotice] = useState<string | null>(null)
  useDayChange((today) => {
    setDayNotice(`Empezó un nuevo día: ${weekdayName(today)} ${formatDayMonth(today)}. La práctica se actualizó.`)
    load()
  })

  const start = (): void => {
    setStarting(true)
    setError(null)
    window.api
      .startPractice()
      .then(setView)
      .catch((err: Error) => setError(err.message))
      .finally(() => setStarting(false))
  }

  let body: React.ReactNode = null
  if (result) {
    body = (
      <ResultCard
        result={result}
        onHome={() => navigate('inicio')}
        onContinue={() => {
          setResult(null)
          load()
        }}
      />
    )
  } else if (view?.status === 'unavailable') {
    body = (
      <section className="card stack">
        <p>{view.reason}</p>
        <div>
          <button className="btn secondary" onClick={() => navigate('inicio')}>
            Volver al inicio
          </button>
        </div>
      </section>
    )
  } else if (view?.status === 'ready') {
    body = <Intro view={view} starting={starting} onStart={start} />
  } else if (view?.status === 'session') {
    body = <SessionPlayer key={view.session.id} session={view.session} onView={setView} onFinished={setResult} />
  } else if (!error) {
    body = <SkeletonCard lines={5} />
  }

  return (
    <>
      <h1>Práctica</h1>
      {dayNotice && <div className="notice day-notice">{dayNotice}</div>}
      {error && (
        <section className="card stack">
          <p className="error multiline">{error}</p>
          <div>
            <button className="btn secondary" onClick={load}>
              Reintentar
            </button>
          </div>
        </section>
      )}
      {body}
    </>
  )
}
