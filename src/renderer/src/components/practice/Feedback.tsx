import type { ExerciseFeedback, ExerciseType } from '@shared/exercises'

function title(type: ExerciseType, feedback: ExerciseFeedback): string {
  if (type === 'writing') return `Puntaje: ${feedback.score}/10`
  if (type === 'reading' && feedback.questionResults && !feedback.correct) {
    return `Acertaste ${feedback.questionResults.filter(Boolean).length} de ${feedback.questionResults.length}`
  }
  return feedback.correct ? '¡Correcto!' : 'No es correcto'
}

export default function Feedback({ type, feedback }: { type: ExerciseType; feedback: ExerciseFeedback }): React.JSX.Element {
  const { review } = feedback
  const showAnswer = feedback.correctAnswer !== null && (!feedback.correct || type === 'writing')

  return (
    <div className={`feedback ${feedback.correct ? 'ok' : 'bad'}`} role="status">
      <p className="feedback-title">{title(type, feedback)}</p>
      {review?.comments && <p>{review.comments}</p>}
      {review && review.mistakes.length > 0 && (
        <ul className="mistakes">
          {review.mistakes.map((m, i) => (
            <li key={i}>
              <s>{m.fragment}</s> → <strong>{m.correction}</strong>: {m.explanation}
            </li>
          ))}
        </ul>
      )}
      {review && type === 'writing' && review.correctedText && (
        <div>
          <span className="level">VERSIÓN CORREGIDA</span>
          <p className="multiline">{review.correctedText}</p>
        </div>
      )}
      {showAnswer && (
        <div>
          <span className="level">{type === 'writing' ? 'RESPUESTA MODELO' : 'RESPUESTA CORRECTA'}</span>
          <p className="multiline">{feedback.correctAnswer}</p>
        </div>
      )}
      {feedback.explanation && <p className="muted">{feedback.explanation}</p>}
    </div>
  )
}
