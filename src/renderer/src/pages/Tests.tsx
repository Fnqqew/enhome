import { useCallback, useEffect, useState } from 'react'
import { formatDayMonth } from '@shared/dates'
import type { ExamEndReason, ExamHistoryItem, ExamResultView, ExamSessionView, ResumeResult, TestsOverview } from '@shared/exams'
import ExamPlayer from '../components/exams/ExamPlayer'
import ExamResult from '../components/exams/ExamResult'
import { useDayChange } from '../hooks/useDay'
import type { Navigate } from '../navigation'

const WEEKLY_RULES =
  'Cuando empieces no vas a poder salir de Pruebas hasta entregarlo. Podés moverte entre las preguntas y cambiar respuestas; se guardan solas. Si se cierra la app, tenés una única pausa de hasta 30 minutos para retomarlo.'

const END_REASON: Record<ExamEndReason, string> = {
  'pause-expired': 'anulado: la pausa venció',
  'second-interruption': 'entregado automáticamente',
  'week-closed': 'fuera de término'
}

type Busy = 'weekly' | 'topic' | 'general' | 'resume' | null

export default function Tests({ navigate, onLockChange }: { navigate: Navigate; onLockChange: (locked: boolean) => void }): React.JSX.Element {
  const [overview, setOverview] = useState<TestsOverview | null>(null)
  const [session, setSession] = useState<ExamSessionView | null>(null)
  const [result, setResult] = useState<ExamResultView | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .getTestsOverview()
      .then((next) => {
        setOverview(next)
        if (next.notice) setNotice(next.notice)
        setSession(next.exam?.state === 'active' ? next.exam.session : null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])
  useDayChange(load)

  const locked = session?.kind === 'weekly' || (overview?.exam?.state === 'paused' && overview.exam.kind === 'weekly')
  useEffect(() => onLockChange(locked), [locked, onLockChange])

  const run = <T,>(kind: Busy, action: () => Promise<T>, done: (value: T) => void): void => {
    setBusy(kind)
    setError(null)
    action()
      .then(done)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null))
  }

  const onResume = (outcome: ResumeResult): void => {
    if (outcome.state === 'active') setSession(outcome.session)
    else if (outcome.state === 'result') setResult(outcome.result)
    else setNotice(outcome.message)
    load()
  }

  const paused = overview?.exam?.state === 'paused' ? overview.exam : null

  if (result) {
    return (
      <>
        <h1>Pruebas</h1>
        <ExamResult
          result={result}
          onClose={() => {
            setResult(null)
            load()
          }}
          onHome={() => {
            setResult(null)
            navigate('inicio')
          }}
        />
      </>
    )
  }

  if (session) {
    return (
      <>
        <h1>Pruebas</h1>
        <ExamPlayer
          key={session.id}
          session={session}
          onSubmitted={(submitted) => {
            setSession(null)
            setResult(submitted)
            load()
          }}
          onLeave={() => {
            setSession(null)
            load()
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1>Pruebas</h1>
      {notice && <div className="notice warn day-notice">{notice}</div>}
      {error && (
        <section className="card">
          <p className="error multiline">{error}</p>
        </section>
      )}
      {!overview ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          {paused && (
            <section className="card stack">
              <h2>Tu examen quedó en pausa</h2>
              <p>
                {paused.title}. Se interrumpió porque se cerró la app o la computadora dejó de responder. Tenés{' '}
                <strong>{paused.minutesLeft} minutos</strong> para retomarlo; es la única pausa de este examen.
              </p>
              <div>
                <button className="btn" disabled={busy !== null} onClick={() => run('resume', () => window.api.resumeExam(paused.examId), onResume)}>
                  {busy === 'resume' ? 'Retomando…' : 'Retomar examen'}
                </button>
              </div>
            </section>
          )}

          <section className="card stack">
            <div className="card-header">
              <div>
                <span className="level">EXAMEN SEMANAL</span>
                <h2>{overview.weekly.topicTitle ?? 'Sin tópico en curso'}</h2>
              </div>
              {overview.weekly.available && <span className="badge ok">{overview.weekly.ready ? 'Listo para rendir' : 'Disponible'}</span>}
            </div>
            <p>{overview.weekly.message}</p>
            {overview.weekly.available && (
              <>
                <p className="muted">{WEEKLY_RULES}</p>
                {overview.weekly.preparing && <p className="muted small">Preparando las preguntas en segundo plano…</p>}
                <div className="row">
                  <button
                    className="btn"
                    disabled={busy !== null || overview.exam !== null}
                    onClick={() => {
                      if (confirm(`${WEEKLY_RULES}\n\n¿Empezás el examen?`)) {
                        run('weekly', () => window.api.startWeeklyExam(), (started) => {
                          setNotice(null)
                          setSession(started)
                        })
                      }
                    }}
                  >
                    {busy === 'weekly' ? 'Preparando el examen…' : 'Rendir examen'}
                  </button>
                  {busy === 'weekly' && !overview.weekly.ready && (
                    <span className="muted">Claude está armando y revisando las preguntas: puede tardar un par de minutos.</span>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="card stack">
            <div>
              <span className="level">SIMULACROS</span>
              <h2>Medí cómo vas</h2>
            </div>
            <p className="muted">
              10 preguntas, un poco más fáciles que el examen. No cuentan para aprobar, pero si fallás mucho en un tópico anterior te lo
              marcamos para repasar. Podés dejarlo y retomarlo.
            </p>
            {overview.mock.reason && <p className="muted">{overview.mock.reason}</p>}
            <div className="row">
              <button
                className="btn secondary"
                disabled={!overview.mock.available || busy !== null}
                onClick={() => run('topic', () => window.api.startMockExam('topic'), setSession)}
              >
                {busy === 'topic' ? 'Armando el simulacro…' : `Del tópico actual${overview.mock.topicTitle ? ` (${overview.mock.topicTitle})` : ''}`}
              </button>
              <button
                className="btn secondary"
                disabled={!overview.mock.available || busy !== null}
                onClick={() => run('general', () => window.api.startMockExam('general'), setSession)}
              >
                {busy === 'general' ? 'Armando el simulacro…' : 'De todo lo visto'}
              </button>
            </div>
            {(busy === 'topic' || busy === 'general') && <p className="muted small">Claude arma y revisa el simulacro: tarda alrededor de un minuto.</p>}
          </section>

          <History
            items={overview.history}
            onOpen={(examId) =>
              window.api
                .getExamResult(examId)
                .then(setResult)
                .catch((err: Error) => setError(err.message))
            }
          />
        </>
      )}
    </>
  )
}

function History({ items, onOpen }: { items: ExamHistoryItem[]; onOpen: (examId: number) => void }): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <section className="card stack">
      <h2>Historial</h2>
      <div className="table-scroll">
        <table className="history">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Prueba</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.date ? formatDayMonth(item.date) : '—'}</td>
                <td>
                  {item.title}
                  {item.endReason && <span className="muted small"> · {END_REASON[item.endReason]}</span>}
                </td>
                <td>
                  {item.status === 'voided' ? (
                    <span className="muted">Anulado</span>
                  ) : (
                    <strong className={item.passed === false ? 'error' : ''}>{item.grade}</strong>
                  )}
                </td>
                <td>
                  {item.status === 'submitted' && (
                    <button type="button" className="chip" onClick={() => onOpen(item.id)}>
                      Ver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
