import { useCallback, useEffect, useRef, useState } from 'react'
import type { Highlight } from '@shared/reading'
import { readLocal, writeLocal } from '../../shell'
import Icon from '../Icon'
import SelectionAsk from './SelectionAsk'
import SpeechControls from './SpeechControls'

type Width = 'narrow' | 'normal' | 'wide'
type Size = 'sm' | 'md' | 'lg'
type Spacing = 'tight' | 'normal' | 'loose'

interface Prefs {
  width: Width
  size: Size
  spacing: Spacing
}

const DEFAULT_PREFS: Prefs = { width: 'normal', size: 'md', spacing: 'normal' }

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(readLocal('reading') ?? '{}') as Partial<Prefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

// Pinta los resaltados con la Custom Highlight API (sin tocar el texto): cada fragmento guardado
// se busca dentro de los nodos de texto del contenido.
function paintHighlights(container: HTMLElement | null, highlights: Highlight[]): void {
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
  const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
  if (!registry || !HighlightCtor) return
  if (!container || highlights.length === 0) {
    registry.delete('enhome-marks')
    return
  }
  const ranges: Range[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const { text } of highlights) {
    const needle = text.replace(/\s+/g, ' ').trim()
    for (const node of nodes) {
      const at = (node.data ?? '').replace(/\s+/g, ' ').indexOf(needle)
      if (at < 0) continue
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, Math.min(node.length, at + needle.length))
      ranges.push(range)
      break
    }
  }
  registry.set('enhome-marks', new HighlightCtor(...ranges))
}

// Vista de lectura sin distracciones, a pantalla completa: ancho, tamaño e interlineado a gusto,
// índice por día, lectura en voz alta, resaltados con notas que quedan guardados y preguntas a Claude.
export default function ReadingMode({
  title,
  topicId,
  docKey,
  speechText,
  onClose,
  children
}: {
  title: string
  topicId: string
  // Identifica el texto para guardar sus resaltados (por ejemplo, «resumen:<tópico>:<tipo>»).
  docKey: string
  // Texto fuente para leer en voz alta (Markdown); si falta, se lee lo que se ve.
  speechText?: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [showPrefs, setShowPrefs] = useState(false)
  const [toc, setToc] = useState<{ id: string; label: string }[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => writeLocal('reading', JSON.stringify(prefs)), [prefs])

  // Índice: los títulos de sección del texto (en los resúmenes, uno por día).
  useEffect(() => {
    const headings = [...(contentRef.current?.querySelectorAll('h2, h3') ?? [])]
    setToc(
      headings.map((h, i) => {
        h.id ||= `seccion-${i}`
        return { id: h.id, label: h.textContent ?? '' }
      })
    )
  }, [children])

  useEffect(() => {
    window.api
      .getHighlights(docKey)
      .then(setHighlights)
      .catch(() => undefined)
  }, [docKey])

  useEffect(() => {
    paintHighlights(contentRef.current, highlights)
    return () => paintHighlights(null, [])
  }, [highlights, children])

  const highlight = useCallback(
    (text: string) => {
      window.api
        .addHighlight(docKey, text)
        .then(setHighlights)
        .catch(() => undefined)
      window.getSelection()?.removeAllRanges()
    },
    [docKey]
  )

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]): void => setPrefs({ ...prefs, [key]: value })

  return (
    <div className="reading-mode" role="dialog" aria-modal="true" aria-label={title}>
      <div className="reading-bar">
        <span className="muted reading-title">{title}</span>
        <SpeechControls getText={() => speechText ?? contentRef.current?.innerText ?? ''} />
        <button type="button" className="chip" aria-expanded={showPrefs} onClick={() => setShowPrefs(!showPrefs)}>
          Aa · Ajustes de lectura
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          Cerrar (Esc)
        </button>
        {showPrefs && (
          <div className="reading-prefs">
            <PrefGroup label="Ancho" value={prefs.width} onChange={(v) => set('width', v)} options={{ narrow: 'Angosto', normal: 'Normal', wide: 'Ancho' }} />
            <PrefGroup label="Letra" value={prefs.size} onChange={(v) => set('size', v)} options={{ sm: 'Chica', md: 'Normal', lg: 'Grande' }} />
            <PrefGroup label="Interlineado" value={prefs.spacing} onChange={(v) => set('spacing', v)} options={{ tight: 'Junto', normal: 'Normal', loose: 'Amplio' }} />
          </div>
        )}
      </div>
      <div className="reading-layout">
        {toc.length > 1 && (
          <nav className="reading-toc" aria-label="Índice">
            <span className="level">ÍNDICE</span>
            {toc.map((item) => (
              <button key={item.id} type="button" onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                {item.label}
              </button>
            ))}
          </nav>
        )}
        <div className={`reading-content width-${prefs.width} size-${prefs.size} spacing-${prefs.spacing}`} ref={contentRef}>
          {children}
          <Marks
            highlights={highlights}
            onNote={(id, note) => {
              setHighlights(highlights.map((h) => (h.id === id ? { ...h, note } : h)))
              window.api.noteHighlight(id, note).catch(() => undefined)
            }}
            onRemove={(id) =>
              window.api
                .removeHighlight(docKey, id)
                .then(setHighlights)
                .catch(() => undefined)
            }
          />
        </div>
      </div>
      <SelectionAsk containerRef={contentRef} topicId={topicId} onHighlight={highlight} />
    </div>
  )
}

function PrefGroup<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div className="row pref-group" role="group" aria-label={label}>
      <span className="muted small">{label}</span>
      {(Object.keys(options) as T[]).map((key) => (
        <button key={key} type="button" className="chip" aria-pressed={value === key} onClick={() => onChange(key)}>
          {options[key]}
        </button>
      ))}
    </div>
  )
}

// Las marcas del texto, con su nota (se guarda al salir del campo).
function Marks({
  highlights,
  onNote,
  onRemove
}: {
  highlights: Highlight[]
  onNote: (id: number, note: string) => void
  onRemove: (id: number) => void
}): React.JSX.Element {
  return (
    <section className="reading-marks" aria-label="Tus marcas">
      <h2>Tus marcas</h2>
      {highlights.length === 0 ? (
        <p className="muted small">Seleccioná un fragmento y elegí «Resaltar» para marcarlo; acá vas a poder sumarle una nota.</p>
      ) : (
        highlights.map((h) => (
          <div key={h.id} className="mark-item">
            <blockquote className="quote">{h.text}</blockquote>
            <div className="row">
              <textarea
                className="text-answer"
                rows={2}
                defaultValue={h.note}
                placeholder="Una nota para vos (opcional)"
                aria-label="Nota"
                onBlur={(e) => e.target.value !== h.note && onNote(h.id, e.target.value)}
              />
              <button type="button" className="icon-button" aria-label="Quitar la marca" onClick={() => onRemove(h.id)}>
                <Icon name="cross" className="glyph" />
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
