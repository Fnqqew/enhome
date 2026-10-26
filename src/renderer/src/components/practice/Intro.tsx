// La presentación del día antes de practicar: qué se trabaja, los puntos clave y los ejemplos.

import { useEffect, useRef } from 'react'
import { prefetchSpeech } from '../../hooks/useSpeech'
import { useSettings } from '../../theme/SettingsProvider'
import { type PracticeView } from '@shared/exercises'
import ClaudeWait from '../ClaudeWait'
import SelectionAsk from '../summaries/SelectionAsk'
import SpeechControls from '../summaries/SpeechControls'
import Heading from './Heading'

export default function Intro({
  view,
  starting,
  onStart
}: {
  view: Extract<PracticeView, { status: 'ready' }>
  starting: boolean
  onStart: () => void
}): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  // Los ejemplos van en cursiva para que se lean con la voz del idioma del curso.
  const speechText = [
    view.subtopicTitle,
    view.goal,
    'Puntos clave:',
    ...view.keyPoints,
    'Ejemplos:',
    ...view.examples.map((e) => `*${e.target}* — ${e.es}`)
  ].join('\n')
  // Mientras lee la presentación, se prepara el audio de los ejemplos.
  const { settings } = useSettings()
  useEffect(() => prefetchSpeech(speechText, settings.language), [speechText, settings.language])

  return (
    <section className="card stack">
      <div className="card-header">
        <div>
          <Heading purpose={view.purpose} unitIndex={view.unitIndex} topicTitle={view.topicTitle} />
          <h2>{view.subtopicTitle}</h2>
        </div>
        {view.kind !== 'lesson' && <span className="badge">{view.kind === 'focus' ? 'Refuerzo' : 'Repaso'}</span>}
      </div>
      <SpeechControls getText={() => speechText} />
      <div ref={contentRef} className="stack">
        <p>{view.goal}</p>
        <div>
          <h3 className="level">PUNTOS CLAVE</h3>
          <ul>
            {view.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="level">EJEMPLOS</h3>
          <ul className="examples">
            {view.examples.map((example, i) => (
              <li key={i}>
                <span className="en">{example.target}</span> <span className="muted">— {example.es}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted small">Seleccioná un texto para preguntarle a Claude.</p>
      <SelectionAsk containerRef={contentRef} topicId={view.topicId} />
      <div className="row">
        <button className="btn" disabled={starting} onClick={onStart}>
          {starting ? 'Preparando ejercicios…' : 'Empezar práctica'}
        </button>
        {starting && (
          <span className="muted">
            Claude está armando y revisando tus ejercicios. Empezás apenas estén los cortos; los largos se suman mientras practicás.
          </span>
        )}
      </div>
      <ClaudeWait active={starting} />
    </section>
  )
}
