import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDayMonth, weekdayName } from '@shared/dates'
import type { LanguageId } from '@shared/languages'
import { MAX_JOURNAL_LENGTH, type JournalEntry, type JournalView } from '@shared/reading'
import ClaudeWait from '../components/ClaudeWait'
import Icon from '../components/Icon'
import { useCourse } from '../hooks/useCourse'
import PageSkeleton from '../components/Skeleton'

const SAVE_DELAY_MS = 800

const PLACEHOLDER: Record<LanguageId, string> = {
  en: 'Today I…',
  pt: 'Hoje eu…',
  it: 'Oggi ho…',
  fr: "Aujourd'hui, j'ai…",
  de: 'Heute habe ich…',
  ru: 'Сегодня я…',
  ja: '今日は…',
  zh: '今天我…',
  ko: '오늘은…'
}

// Diario: una entrada corta por día en el idioma del curso; Claude la corrige y queda guardada.
export default function Journal(): React.JSX.Element {
  const course = useCourse()
  const [view, setView] = useState<JournalView | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const apply = useCallback((v: JournalView) => {
    setView(v)
  }, [])

  useEffect(() => {
    window.api
      .getJournal()
      .then((v) => {
        setView(v)
        setText(v.today?.text ?? '')
      })
      .catch((err: Error) => setError(err.message))
    return () => clearTimeout(timer.current)
  }, [])

  // El borrador se guarda solo mientras se escribe.
  const change = (value: string): void => {
    setText(value)
    clearTimeout(timer.current)
    setSaving(true)
    timer.current = setTimeout(() => {
      window.api
        .saveJournal(value)
        .then(apply)
        .catch((err: Error) => setError(err.message))
        .finally(() => setSaving(false))
    }, SAVE_DELAY_MS)
  }

  const correct = async (): Promise<void> => {
    clearTimeout(timer.current)
    setCorrecting(true)
    setError(null)
    try {
      await window.api.saveJournal(text)
      setView(await window.api.correctJournal())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCorrecting(false)
      setSaving(false)
    }
  }

  if (!view) return error ? <p className="error">{error}</p> : <PageSkeleton />

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const today = view.today
  return (
    <>
      <div className="row spread">
        <h1>Diario</h1>
        {view.streak > 0 && (
          <span className="badge">
            <Icon name="flame" className="glyph" /> {view.streak} {view.streak === 1 ? 'día' : 'días'} seguidos
          </span>
        )}
      </div>
      <section className="card stack fade-in">
        <div>
          <span className="level">HOY</span>
          <h2>Escribí unas líneas en {course.name}</h2>
        </div>
        <p className="muted small">
          No hace falta que sea largo: tres o cuatro oraciones alcanzan. Si no sabés cómo decir algo, escribilo en español y Claude te muestra cómo se
          dice.
        </p>
        <div className="chip-grid" aria-label="Ideas para escribir">
          {view.prompts.map((p) => (
            <span key={p} className="badge idea">
              {p}
            </span>
          ))}
        </div>
        <textarea
          className="text-answer journal-text en"
          rows={7}
          maxLength={MAX_JOURNAL_LENGTH}
          value={text}
          placeholder={PLACEHOLDER[course.id]}
          spellCheck={false}
          onChange={(e) => change(e.target.value)}
        />
        <div className="row spread">
          <span className="muted small">
            {words} {words === 1 ? 'palabra' : 'palabras'} · {saving ? 'guardando…' : 'guardado'}
          </span>
          <button className="btn" disabled={correcting || words < 5} onClick={() => void correct()}>
            {correcting ? 'Claude está corrigiendo…' : today?.review ? 'Corregir de nuevo' : 'Corregir con Claude'}
          </button>
        </div>
        <ClaudeWait active={correcting} />
        {error && <p className="error multiline">{error}</p>}
        {today?.review && <Review entry={today} />}
      </section>

      {view.past.length > 0 && (
        <section className="card stack fade-in">
          <h2>Entradas anteriores</h2>
          {view.past.map((entry) => (
            <details key={entry.day} className="journal-entry">
              <summary>
                <span>
                  {weekdayName(entry.day)} {formatDayMonth(entry.day)}
                </span>
                {entry.review ? <span className="badge ok">{entry.review.score}/10</span> : <span className="badge">Sin corregir</span>}
              </summary>
              <p className="multiline en">{entry.text}</p>
              {entry.review && <Review entry={entry} />}
            </details>
          ))}
        </section>
      )}
    </>
  )
}

function Review({ entry }: { entry: JournalEntry }): React.JSX.Element {
  const review = entry.review!
  return (
    <div className={`feedback ${review.score >= 6 ? 'ok' : 'bad'}`} role="status">
      <p className="feedback-title">Puntaje: {review.score}/10</p>
      <p>{review.comments}</p>
      {review.mistakes.length > 0 && (
        <ul className="mistakes">
          {review.mistakes.map((m, i) => (
            <li key={i}>
              <s>{m.fragment}</s> → <strong>{m.correction}</strong>: {m.explanation}
            </li>
          ))}
        </ul>
      )}
      <div>
        <span className="level">VERSIÓN CORREGIDA</span>
        <p className="multiline en">{review.correctedText}</p>
      </div>
      {review.tip && (
        <p className="small">
          <strong>Para sumar:</strong> <span className="en">{review.tip}</span>
        </p>
      )}
      {entry.edited && <p className="muted small">Cambiaste el texto después de esta corrección.</p>}
    </div>
  )
}
