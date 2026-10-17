import { useEffect, useState, type RefObject } from 'react'
import type { WordInfo } from '@shared/vocab'
import Markdown from '../Markdown'

const MIN_SELECTION = 2
const MAX_SELECTION = 1500
// Hasta cuántas palabras se ofrece «Traducir» (una palabra o una expresión corta).
const MAX_WORDS_TO_TRANSLATE = 5

interface Anchor {
  x: number
  y: number
  text: string
  // La oración o el párrafo donde aparece, para traducir en contexto.
  context: string
}

function contextOf(range: Range): string {
  let node: Node | null = range.commonAncestorContainer
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode
  const block = (node as Element | null)?.closest('p, li, td, blockquote, .option, .en, h2, h3, div')
  return (block?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)
}

const isShort = (text: string): boolean => text.split(/\s+/).length <= MAX_WORDS_TO_TRANSLATE && text.length <= 60

// Botón flotante para preguntarle a Claude sobre el texto seleccionado dentro del contenedor.
export default function SelectionAsk({
  containerRef,
  topicId,
  onHighlight
}: {
  containerRef: RefObject<HTMLElement | null>
  topicId: string
  // En el modo lectura: guarda el fragmento seleccionado como resaltado.
  onHighlight?: (text: string) => void
}): React.JSX.Element {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [fragment, setFragment] = useState<string | null>(null)
  const [word, setWord] = useState<Anchor | null>(null)

  useEffect(() => {
    const onSelection = (): void => {
      // Se espera a que el navegador actualice la selección.
      setTimeout(() => {
        const selection = window.getSelection()
        const container = containerRef.current
        const text = selection?.toString().trim() ?? ''
        if (
          !selection ||
          !container ||
          selection.rangeCount === 0 ||
          text.length < MIN_SELECTION ||
          text.length > MAX_SELECTION ||
          !container.contains(selection.getRangeAt(0).commonAncestorContainer)
        ) {
          setAnchor(null)
          return
        }
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setAnchor({ x: rect.left + rect.width / 2, y: rect.top, text, context: contextOf(range) })
      }, 0)
    }
    document.addEventListener('mouseup', onSelection)
    document.addEventListener('keyup', onSelection)
    return () => {
      document.removeEventListener('mouseup', onSelection)
      document.removeEventListener('keyup', onSelection)
    }
  }, [containerRef])

  return (
    <>
      {anchor && !fragment && !word && (isShort(anchor.text) || topicId || onHighlight) && (
        <div className="ask-float" style={{ left: anchor.x, top: Math.max(8, anchor.y - 44) }}>
          {isShort(anchor.text) && (
            <button
              type="button"
              // Evita que el clic borre la selección antes de abrir el diálogo.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setWord(anchor)}
            >
              Traducir
            </button>
          )}
          {onHighlight && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onHighlight(anchor.text)
                setAnchor(null)
              }}
            >
              Resaltar
            </button>
          )}
          {/* Sin tópico (por ejemplo, en la charla) solo se ofrece traducir. */}
          {topicId && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFragment(anchor.text)}>
              Preguntar a Claude
            </button>
          )}
        </div>
      )}
      {word && (
        <WordPopover
          anchor={word}
          onClose={() => {
            setWord(null)
            setAnchor(null)
          }}
        />
      )}
      {fragment && (
        <AskDialog
          fragment={fragment}
          topicId={topicId}
          onClose={() => {
            setFragment(null)
            setAnchor(null)
          }}
        />
      )}
    </>
  )
}

// Traducción en contexto de una palabra o expresión, con la opción de guardarla en el vocabulario.
function WordPopover({ anchor, onClose }: { anchor: Anchor; onClose: () => void }): React.JSX.Element {
  const [info, setInfo] = useState<(WordInfo & { saved: boolean }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api
      .lookupWord(anchor.text, anchor.context)
      .then(setInfo)
      .catch((err: Error) => setError(err.message))
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent): void => {
      if (!(e.target as Element).closest('.word-popover')) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const save = (): void => {
    if (!info) return
    setSaving(true)
    window.api
      .saveWord(info)
      .then(() => setInfo({ ...info, saved: true }))
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  // Se abre debajo de la selección, sin salirse de la ventana.
  const left = Math.min(Math.max(12, anchor.x - 170), window.innerWidth - 352)
  const top = anchor.y + 28 > window.innerHeight - 220 ? Math.max(12, anchor.y - 230) : anchor.y + 28
  return (
    <div className="word-popover card stack-sm" role="dialog" aria-label={`Traducción de ${anchor.text}`} style={{ left, top }}>
      {!info && !error && <p className="muted">Traduciendo «{anchor.text}»…</p>}
      {error && <p className="error small">{error}</p>}
      {info && (
        <>
          <div>
            <strong className="en">{info.term}</strong> <span className="muted">— {info.translation}</span>
          </div>
          <p className="small">
            <span className="en">{info.example}</span>
            <br />
            <span className="muted">{info.exampleEs}</span>
          </p>
          {info.note && <p className="muted small">{info.note}</p>}
          <div className="row">
            <button className="btn" disabled={info.saved || saving} onClick={save}>
              {info.saved ? 'Guardada en tu vocabulario' : saving ? 'Guardando…' : 'Guardar en vocabulario'}
            </button>
            <button className="btn secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AskDialog({ fragment, topicId, onClose }: { fragment: string; topicId: string; onClose: () => void }): React.JSX.Element {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    window.api
      .askAboutText(topicId, fragment, question)
      .then((r) => setAnswer(r.answer))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal card stack" role="dialog" aria-modal="true" aria-label="Preguntale a Claude" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Preguntale a Claude</h2>
        <blockquote className="quote">{fragment}</blockquote>
        <form className="stack-sm" onSubmit={submit}>
          <input
            className="text-answer"
            autoFocus
            value={question}
            maxLength={500}
            placeholder="¿Qué querés saber? Si lo dejás vacío, te lo explica con otras palabras."
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="row">
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Pensando…' : answer ? 'Preguntar otra cosa' : 'Preguntar'}
            </button>
            <button className="btn secondary" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
        {answer && (
          <div className="answer">
            <Markdown markdown={answer} />
          </div>
        )}
      </div>
    </div>
  )
}
