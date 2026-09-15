import { useEffect, useRef, useState } from 'react'
import { CEFR_LEVELS } from '@shared/curriculum'
import {
  BASE_SUMMARY_TYPE,
  SUMMARY_TYPES,
  type SummariesIndex,
  type SummaryContent,
  type SummaryTypeId,
  type SummaryView
} from '@shared/summaries'
import Markdown from '../components/Markdown'
import Rating from '../components/Rating'
import Flashcards from '../components/summaries/Flashcards'
import ReadingMode from '../components/summaries/ReadingMode'
import SelectionAsk from '../components/summaries/SelectionAsk'
import SpeechControls from '../components/summaries/SpeechControls'

const STATUS_NOTE = { current: ' (en curso)', review: ' (para repasar)', passed: '' } as const

function Content({ content }: { content: SummaryContent }): React.JSX.Element {
  return content.format === 'markdown' ? <Markdown markdown={content.markdown} /> : <Flashcards cards={content.cards} />
}

export default function Summaries(): React.JSX.Element {
  const [index, setIndex] = useState<SummariesIndex | null>(null)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [type, setType] = useState<SummaryTypeId>(BASE_SUMMARY_TYPE)
  const [view, setView] = useState<SummaryView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reading, setReading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  // Lo que se está mirando ahora, para descartar respuestas que llegan tarde.
  const selection = useRef({ topicId, type })
  selection.current = { topicId, type }

  useEffect(() => {
    window.api
      .getSummariesIndex()
      .then((result) => {
        setIndex(result)
        if (result.unlocked) setTopicId(result.currentTopicId ?? result.topics[result.topics.length - 1]?.id ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!topicId) return
    let cancelled = false
    setView(null)
    setError(null)
    window.api
      .getSummary(topicId, type)
      .then((result) => !cancelled && setView(result))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [topicId, type])

  const isCurrent = (result: SummaryView): boolean =>
    result.topicId === selection.current.topicId && result.type === selection.current.type

  const generate = (regenerate: boolean): void => {
    if (!topicId) return
    setGenerating(true)
    setError(null)
    window.api
      .generateSummary(topicId, type, regenerate)
      .then((result) => isCurrent(result) && setView(result))
      .catch((err: Error) => setError(err.message))
      .finally(() => setGenerating(false))
  }

  const rate = (rating: 1 | 3 | 5): void => {
    if (!topicId) return
    window.api
      .rateSummary(topicId, type, rating)
      .then((result) => {
        if (isCurrent(result)) setView(result)
        return window.api.getSummariesIndex().then(setIndex)
      })
      .catch((err: Error) => setError(err.message))
  }

  if (!index) {
    return (
      <>
        <h1>Resúmenes</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Cargando…</p>}
      </>
    )
  }

  if (!index.unlocked) {
    return (
      <>
        <h1>Resúmenes</h1>
        <section className="card">
          <p>{index.reason}</p>
        </section>
      </>
    )
  }

  const info = SUMMARY_TYPES[type]
  const typeView = index.types.find((t) => t.id === type)
  const content = view?.content ?? null

  return (
    <>
      <h1>Resúmenes</h1>

      <section className="card wide stack">
        <div className="row">
          <label className="muted" htmlFor="summary-topic">
            Tópico
          </label>
          <select id="summary-topic" value={topicId ?? ''} onChange={(e) => setTopicId(e.target.value)}>
            {CEFR_LEVELS.map((level) => {
              const topics = index.topics.filter((t) => t.level === level)
              if (topics.length === 0) return null
              return (
                <optgroup key={level} label={level}>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {STATUS_NOTE[t.status]}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        <div className="type-chips" role="tablist" aria-label="Tipo de resumen">
          {index.types.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === type} className="type-chip" onClick={() => setType(t.id)}>
              {t.favorite && <span className="star" aria-label="favorito">★</span>}
              {t.label}
              {view?.generatedTypes.includes(t.id) && <span className="ready-dot" title="Ya generado para este tópico" />}
              {t.recommended && <span className="mini-badge">Recomendado</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="card wide stack">
        <div className="card-header">
          <div>
            <h2>{info.label}</h2>
            <p className="muted">{info.description}</p>
          </div>
          <div className="row toolbar">
            <button
              type="button"
              className="chip"
              aria-pressed={typeView?.favorite ?? false}
              onClick={() => window.api.setFavoriteSummaryType(type, !typeView?.favorite).then(setIndex).catch((err: Error) => setError(err.message))}
            >
              {typeView?.favorite ? '★ Favorito' : '☆ Favorito'}
            </button>
            {content && (
              <button type="button" className="chip" onClick={() => setReading(true)}>
                Modo lectura
              </button>
            )}
            {view?.source === 'ai' && (
              <button type="button" className="chip" disabled={generating} onClick={() => generate(true)}>
                {generating ? 'Regenerando…' : 'Regenerar'}
              </button>
            )}
          </div>
        </div>

        {content?.format === 'markdown' && <SpeechControls key={`${topicId}/${type}`} getText={() => content.markdown} />}
        {error && <p className="error multiline">{error}</p>}

        {!view && !error && <p className="muted">Cargando…</p>}
        {view && !content && (
          <div className="notice stack-sm">
            <p>Este resumen todavía no existe para «{view.topicTitle}».</p>
            <p className="muted">Claude lo escribe y un revisor lo controla antes de mostrártelo. Tarda alrededor de un minuto y queda guardado.</p>
            <div>
              <button className="btn" disabled={generating} onClick={() => generate(false)}>
                {generating ? 'Escribiendo y revisando…' : 'Generar resumen'}
              </button>
            </div>
          </div>
        )}
        {content && (
          <div ref={contentRef} className="summary-content">
            <Content content={content} />
          </div>
        )}

        {content && (
          <div className="row spread">
            <Rating value={view?.rating ?? null} onRate={rate} label="¿Te sirvió este resumen?" />
            {content.format === 'markdown' && <span className="muted small">Seleccioná un texto para preguntarle a Claude.</span>}
          </div>
        )}
        {topicId && <SelectionAsk containerRef={contentRef} topicId={topicId} />}
      </section>

      {reading && content && topicId && view && (
        <ReadingMode
          title={`${info.label} · ${view.topicTitle}`}
          topicId={topicId}
          speechText={content.format === 'markdown' ? content.markdown : undefined}
          onClose={() => setReading(false)}
        >
          <Content content={content} />
        </ReadingMode>
      )}
    </>
  )
}
