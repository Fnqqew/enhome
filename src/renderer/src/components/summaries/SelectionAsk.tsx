import { useEffect, useState, type RefObject } from 'react'
import Markdown from '../Markdown'

const MIN_SELECTION = 2
const MAX_SELECTION = 1500

// Botón flotante para preguntarle a Claude sobre el texto seleccionado dentro del contenedor.
export default function SelectionAsk({ containerRef, topicId }: { containerRef: RefObject<HTMLElement | null>; topicId: string }): React.JSX.Element {
  const [anchor, setAnchor] = useState<{ x: number; y: number; text: string } | null>(null)
  const [fragment, setFragment] = useState<string | null>(null)

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
        const rect = selection.getRangeAt(0).getBoundingClientRect()
        setAnchor({ x: rect.left + rect.width / 2, y: rect.top, text })
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
      {anchor && !fragment && (
        <button
          type="button"
          className="ask-float"
          style={{ left: anchor.x, top: Math.max(8, anchor.y - 44) }}
          // Evita que el clic borre la selección antes de abrir el diálogo.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setFragment(anchor.text)}
        >
          Preguntar a Claude
        </button>
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
