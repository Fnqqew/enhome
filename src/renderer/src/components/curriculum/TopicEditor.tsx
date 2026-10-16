import { useEffect, useState } from 'react'
import type { CurriculumTopic, Subtopic, Topic } from '@shared/curriculum'
import Icon from '../Icon'

type Example = Subtopic['examples'][number]
type Mistake = Subtopic['commonMistakes'][number]

const lines = (value: string): string[] =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

// Revisión de un tópico desde la app: se corrige el contenido y se marca como revisado.
// El id, el nivel y el orden no se tocan: definen el recorrido del curso.
export default function TopicEditor({ topicId, onClose, onSaved }: { topicId: string; onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getCurriculum()
      .then((all) => {
        const found = all.find((t) => t.id === topicId)
        if (!found) throw new Error('No se encontró el tópico.')
        const { language: _language, summary: text, ...data } = found as CurriculumTopic
        setTopic(data)
        setSummary(text)
      })
      .catch((err: Error) => setError(err.message))
  }, [topicId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = (markReviewed: boolean): void => {
    if (!topic) return
    setSaving(true)
    setError(null)
    window.api
      .saveTopicReview(topicId, { topic, summary }, markReviewed)
      .then(() => onSaved())
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const setSub = (index: number, patch: Partial<Subtopic>): void => {
    if (!topic) return
    setTopic({ ...topic, subtopics: topic.subtopics.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal card stack editor" role="dialog" aria-modal="true" aria-label="Revisar tópico" onMouseDown={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <span className="level">REVISAR TÓPICO</span>
            <h2>{topic?.title ?? 'Cargando…'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="cross" className="glyph" />
          </button>
        </div>
        {!topic ? (
          error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>
        ) : (
          <>
            <p className="muted small">
              Corregí lo que haga falta y marcalo como revisado. Los cambios se usan en las prácticas, los exámenes y los resúmenes desde
              ahora.
            </p>
            <div className="editor-grid">
              <Field label="Título">
                <input className="text-answer" value={topic.title} onChange={(e) => setTopic({ ...topic, title: e.target.value })} />
              </Field>
              <Field label="Título en el idioma">
                <input className="text-answer en" value={topic.targetTitle} onChange={(e) => setTopic({ ...topic, targetTitle: e.target.value })} />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea className="text-answer" rows={2} value={topic.description} onChange={(e) => setTopic({ ...topic, description: e.target.value })} />
            </Field>
            <Field label="Objetivos (uno por línea)">
              <textarea
                className="text-answer"
                rows={4}
                defaultValue={topic.objectives.join('\n')}
                onChange={(e) => setTopic({ ...topic, objectives: lines(e.target.value) })}
              />
            </Field>

            {[...topic.subtopics]
              .map((s, i) => ({ s, i }))
              .sort((a, b) => a.s.day - b.s.day)
              .map(({ s, i }) => (
                <details key={s.id} className="editor-subtopic">
                  <summary>
                    Día {s.day} · {s.title}
                  </summary>
                  <div className="stack-sm">
                    <div className="editor-grid">
                      <Field label="Título">
                        <input className="text-answer" value={s.title} onChange={(e) => setSub(i, { title: e.target.value })} />
                      </Field>
                      <Field label="Objetivo">
                        <input className="text-answer" value={s.goal} onChange={(e) => setSub(i, { goal: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Puntos clave (uno por línea)">
                      <textarea
                        className="text-answer"
                        rows={4}
                        defaultValue={s.keyPoints.join('\n')}
                        onChange={(e) => setSub(i, { keyPoints: lines(e.target.value) })}
                      />
                    </Field>
                    <Rows<Example>
                      label="Ejemplos"
                      items={s.examples}
                      empty={{ target: '', es: '' }}
                      columns={[
                        { key: 'target', placeholder: 'En el idioma', target: true },
                        { key: 'es', placeholder: 'En español' }
                      ]}
                      onChange={(examples) => setSub(i, { examples })}
                    />
                    <Rows<Mistake>
                      label="Errores típicos"
                      items={s.commonMistakes}
                      empty={{ wrong: '', right: '', why: '' }}
                      columns={[
                        { key: 'wrong', placeholder: 'Incorrecto', target: true },
                        { key: 'right', placeholder: 'Correcto', target: true },
                        { key: 'why', placeholder: 'Por qué' }
                      ]}
                      onChange={(commonMistakes) => setSub(i, { commonMistakes })}
                    />
                  </div>
                </details>
              ))}

            <Field label="Resumen (Markdown, con una sección «## Día N» por día)">
              <textarea className="text-answer mono editor-summary" rows={14} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </Field>

            {error && <p className="error multiline">{error}</p>}
            <div className="row">
              <button className="btn" disabled={saving} onClick={() => save(true)}>
                {saving ? 'Guardando…' : 'Guardar y marcar como revisado'}
              </button>
              <button className="btn secondary" disabled={saving} onClick={() => save(topic.reviewed)}>
                Guardar sin cambiar el estado
              </button>
              <button className="btn secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="stack-sm field">
      <span className="small">{label}</span>
      {children}
    </label>
  )
}

interface Column<T> {
  key: keyof T & string
  placeholder: string
  target?: boolean
}

function Rows<T extends Record<string, string>>({
  label,
  items,
  empty,
  columns,
  onChange
}: {
  label: string
  items: T[]
  empty: T
  columns: Column<T>[]
  onChange: (items: T[]) => void
}): React.JSX.Element {
  return (
    <div className="stack-sm">
      <span className="small">{label}</span>
      {items.map((item, i) => (
        <div key={i} className="editor-row">
          {columns.map((c) => (
            <input
              key={c.key}
              className={`text-answer${c.target ? ' en' : ''}`}
              value={item[c.key]}
              placeholder={c.placeholder}
              aria-label={`${label} ${i + 1}: ${c.placeholder}`}
              onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, [c.key]: e.target.value } : it)))}
            />
          ))}
          <button type="button" className="icon-button" aria-label={`Quitar ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Icon name="cross" className="glyph" />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="chip" onClick={() => onChange([...items, { ...empty }])}>
          + Agregar
        </button>
      </div>
    </div>
  )
}
