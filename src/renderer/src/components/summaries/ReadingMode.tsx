import { useEffect, useRef } from 'react'
import SelectionAsk from './SelectionAsk'
import SpeechControls from './SpeechControls'

// Vista de lectura sin distracciones, a pantalla completa, con lectura en voz alta y preguntas a Claude.
export default function ReadingMode({
  title,
  topicId,
  onClose,
  children
}: {
  title: string
  topicId: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="reading-mode" role="dialog" aria-modal="true" aria-label={title}>
      <div className="reading-bar">
        <span className="muted reading-title">{title}</span>
        <SpeechControls getText={() => contentRef.current?.innerText ?? ''} />
        <button type="button" className="btn secondary" onClick={onClose}>
          Cerrar (Esc)
        </button>
      </div>
      <div className="reading-content" ref={contentRef}>
        {children}
      </div>
      <SelectionAsk containerRef={contentRef} topicId={topicId} />
    </div>
  )
}
