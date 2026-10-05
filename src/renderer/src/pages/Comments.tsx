import { useCallback, useEffect, useState } from 'react'
import { FEEDBACK_KINDS, type FeedbackKind, type FeedbackNote } from '@shared/feedback'
import { SECTIONS, SECTION_LABELS, type SectionId } from '@shared/sections'

const KIND_OF = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.id, k])) as Record<FeedbackKind, (typeof FEEDBACK_KINDS)[number]>

// Cuaderno de notas sobre la app: ideas, cosas que fallan y lo que conviene no tocar.
export default function Comments(): React.JSX.Element {
  const [notes, setNotes] = useState<FeedbackNote[] | null>(null)
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [section, setSection] = useState<SectionId | 'general'>('general')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    window.api
      .getFeedback()
      .then(setNotes)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  const add = (event: React.FormEvent): void => {
    event.preventDefault()
    if (!message.trim() || saving) return
    setSaving(true)
    setError(null)
    window.api
      .addFeedback({ kind, section, message: message.trim() })
      .then((next) => {
        setNotes(next)
        setMessage('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const act = (promise: Promise<FeedbackNote[]>): void => {
    promise.then(setNotes).catch((err: Error) => setError(err.message))
  }

  const copy = (): void => {
    if (!notes || notes.length === 0) return
    const text = notes
      .map((n) => `- [${n.done ? 'x' : ' '}] (${KIND_OF[n.kind].label} · ${SECTION_LABELS[n.section as SectionId] ?? 'General'}) ${n.message}`)
      .join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => setError('No se pudo copiar al portapapeles.'))
  }

  const pending = notes?.filter((n) => !n.done) ?? []
  const done = notes?.filter((n) => n.done) ?? []

  return (
    <>
      <h1>Comentarios</h1>
      <p className="page-intro">
        Anotá acá lo que se te ocurra mientras usás la app: una idea, algo que falla o algo que te gusta como está. Queda guardado en tu
        computadora y te sirve para contarme qué cambiar.
      </p>

      <section className="card stack fade-in">
        <h2>Anotar algo nuevo</h2>
        <form className="stack" onSubmit={add}>
          <div className="type-chips" role="group" aria-label="Tipo de comentario">
            {FEEDBACK_KINDS.map((k) => (
              <button key={k.id} type="button" className="type-chip" aria-pressed={k.id === kind} title={k.hint} onClick={() => setKind(k.id)}>
                <span aria-hidden="true">{k.icon}</span> {k.label}
              </button>
            ))}
          </div>

          <div className="setting-row">
            <label htmlFor="feedback-section">¿De qué parte?</label>
            <select id="feedback-section" value={section} onChange={(e) => setSection(e.target.value as SectionId | 'general')}>
              <option value="general">General</option>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="text-answer"
            rows={3}
            value={message}
            placeholder="Por ejemplo: en Práctica me gustaría poder volver a un ejercicio anterior."
            aria-label="Comentario"
            onChange={(e) => setMessage(e.target.value)}
          />

          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn" type="submit" disabled={!message.trim() || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="btn secondary" type="button" disabled={!notes || notes.length === 0} onClick={copy}>
              {copied ? '¡Copiado!' : 'Copiar todo'}
            </button>
          </div>
        </form>
      </section>

      {notes === null ? (
        <p className="muted">Cargando…</p>
      ) : notes.length === 0 ? (
        <section className="card empty-state fade-in">
          <span className="empty-icon" aria-hidden="true">
            💬
          </span>
          <p>Todavía no anotaste nada.</p>
          <p className="muted">Lo que anotes va a aparecer acá, lo más nuevo primero.</p>
        </section>
      ) : (
        <>
          <NoteList title={`Pendientes (${pending.length})`} notes={pending} onToggle={(id) => act(window.api.toggleFeedback(id))} onRemove={(id) => act(window.api.removeFeedback(id))} />
          {done.length > 0 && (
            <NoteList title={`Listas (${done.length})`} notes={done} onToggle={(id) => act(window.api.toggleFeedback(id))} onRemove={(id) => act(window.api.removeFeedback(id))} />
          )}
        </>
      )}
    </>
  )
}

function NoteList({
  title,
  notes,
  onToggle,
  onRemove
}: {
  title: string
  notes: FeedbackNote[]
  onToggle: (id: number) => void
  onRemove: (id: number) => void
}): React.JSX.Element | null {
  if (notes.length === 0) return null
  return (
    <section className="card stack fade-in">
      <h2>{title}</h2>
      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id} className={`note${note.done ? ' done' : ''}`}>
            <span className="note-icon" aria-hidden="true">
              {KIND_OF[note.kind].icon}
            </span>
            <div className="note-body">
              <p className="multiline">{note.message}</p>
              <span className="muted small">
                {KIND_OF[note.kind].label} · {SECTION_LABELS[note.section as SectionId] ?? 'General'} · {note.createdAt.slice(0, 10)}
              </span>
            </div>
            <div className="row">
              <button className="chip" type="button" onClick={() => onToggle(note.id)}>
                {note.done ? 'Reabrir' : 'Marcar lista'}
              </button>
              <button className="chip" type="button" onClick={() => onRemove(note.id)}>
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
