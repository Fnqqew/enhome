import { formatDayMonth, weekdayName } from '@shared/dates'
import type { ExamResultView } from '@shared/exams'
import { EXERCISE_TYPE_LABELS } from '@shared/exercises'
import ExerciseInput from '../practice/ExerciseInput'
import Feedback from '../practice/Feedback'

function message(result: ExamResultView): string {
  const { outcome } = result
  const when = (date: string): string => `${weekdayName(date)} ${formatDayMonth(date)}`
  if (result.kind === 'mock') return 'Los simulacros no cuentan para aprobar: sirven para saber cómo vas.'
  if (result.passed) {
    if (outcome?.finished) return '¡Aprobaste y completaste todo el temario disponible!'
    return outcome?.nextWeekStart ? `¡Aprobaste! Tu próximo tópico arranca el ${when(outcome.nextWeekStart)}.` : '¡Aprobaste!'
  }
  return outcome?.nextWeekStart
    ? `Se aprueba con 8. Desde el ${when(outcome.nextWeekStart)} tenés una semana de refuerzo enfocada en lo que más te costó, y después volvés a rendir.`
    : 'Se aprueba con 8.'
}

export default function ExamResult({ result, onClose, onHome }: { result: ExamResultView; onClose: () => void; onHome: () => void }): React.JSX.Element {
  const weakTopics = result.outcome?.weakTopics ?? []

  return (
    <>
      <section className="card wide stack">
        <span className="level">{result.kind === 'weekly' ? 'RESULTADO DEL EXAMEN' : 'RESULTADO DEL SIMULACRO'}</span>
        <h2>{result.title}</h2>
        <div className="row">
          <span className={`grade${result.passed === false ? ' failed' : ''}`}>{result.grade}</span>
          {result.kind === 'weekly' && <span className={`badge${result.passed ? ' ok' : ''}`}>{result.passed ? 'Aprobado' : 'No aprobado'}</span>}
        </div>
        {result.endReason === 'second-interruption' && (
          <div className="notice warn">Se entregó automáticamente porque el examen se interrumpió por segunda vez.</div>
        )}
        <p>{message(result)}</p>
        {weakTopics.length > 0 && <div className="notice">Te recomendamos repasar: {weakTopics.join(', ')}.</div>}
        <div className="row">
          <button className="btn" onClick={onHome}>
            Ir al inicio
          </button>
          <button className="btn secondary" onClick={onClose}>
            Volver a Pruebas
          </button>
        </div>
      </section>

      {result.breakdown.length > 0 && (
        <section className="card wide stack">
          <h2>Por subtema</h2>
          <div className="table-scroll">
            <table className="history">
              <thead>
                <tr>
                  <th>Subtema</th>
                  <th>Correctas</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.map((item) => (
                  <tr key={`${item.topicTitle}/${item.subtopicTitle}`}>
                    <td>
                      {item.subtopicTitle} <span className="muted small">· {item.topicTitle}</span>
                    </td>
                    <td className={item.correct < item.total / 2 ? 'error' : ''}>
                      {item.correct} de {item.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.questions.length > 0 && (
        <section className="card wide stack">
          <h2>Corrección pregunta por pregunta</h2>
          {result.questions.map((q) => (
            <div key={q.index} className="review-item stack-sm">
              <div className="row spread">
                <strong>
                  {q.index + 1}. {EXERCISE_TYPE_LABELS[q.type]}
                </strong>
                <span className="muted small">
                  {q.topicTitle} › {q.subtopicTitle}
                </span>
              </div>
              <p>{q.content.instruction}</p>
              <ExerciseInput content={q.content} answer={q.answer} feedback={q.feedback} onChange={() => undefined} />
              {!q.answer && <p className="muted small">Sin responder.</p>}
              {q.feedback && <Feedback type={q.type} feedback={q.feedback} />}
            </div>
          ))}
        </section>
      )}
    </>
  )
}
