// La microlección antes de practicar: qué se aprende, la regla, ejemplos para escuchar, el contraste
// con el español y una pregunta para comprobar que se entendió. Primero se ve lo nuevo y después se
// recuerda en la práctica.

import { useEffect, useMemo, useRef, useState } from 'react'
import { prefetchSpeech, useSpeech } from '../../hooks/useSpeech'
import { useSettings } from '../../theme/SettingsProvider'
import { type PracticeView } from '@shared/exercises'
import { DIFFICULTY_LABELS, STEP_UP_RATIO, STEP_UP_STREAK, type DifficultyState } from '@shared/difficulty'
import { OptionList } from '../../exercise-types/common'
import ClaudeWait from '../ClaudeWait'
import Icon from '../Icon'
import SelectionAsk from '../summaries/SelectionAsk'
import SpeechControls from '../summaries/SpeechControls'
import Heading from './Heading'

type Mistake = { wrong: string; right: string; why: string }

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
  const speech = useSpeech()
  // El primer error típico se muestra como contraste; el último se pregunta (si hay uno solo, solo se pregunta).
  const mistakes = view.commonMistakes
  const contrast = mistakes.length > 1 ? mistakes.slice(0, -1) : []
  const check = mistakes.at(-1)
  // Los ejemplos van en cursiva para que se lean con la voz del idioma del curso.
  const speechText = [
    view.subtopicTitle,
    view.goal,
    'La regla:',
    ...view.keyPoints,
    'Ejemplos:',
    ...view.examples.map((e) => `*${e.target}* — ${e.es}`)
  ].join('\n')
  // Mientras lee la microlección, se prepara el audio de los ejemplos.
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
      <DifficultyNote state={view.difficulty} />
      <SpeechControls getText={() => speechText} />
      <div ref={contentRef} className="stack lesson">
        <div>
          <h3 className="level">HOY APRENDÉS</h3>
          <p>{view.goal}</p>
        </div>
        <div>
          <h3 className="level">LA REGLA</h3>
          <ul>
            {view.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="level">EJEMPLOS</h3>
          <ul className="examples lesson-examples">
            {view.examples.map((example, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Escuchar «${example.target}»`}
                  onClick={() => speech.speakAs(example.target, settings.language)}
                >
                  <Icon name="play" className="glyph" />
                </button>
                <span>
                  <span className="en">{example.target}</span> <span className="muted">— {example.es}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {view.chunks.length > 0 && (
          <div>
            <h3 className="level">FRASES PARA LLEVARTE</h3>
            <p className="muted small">Se dicen así, enteras. Al terminar la práctica pasan a tus tarjetas.</p>
            <ul className="examples lesson-examples">
              {view.chunks.map((chunk, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Escuchar «${chunk.example}»`}
                    onClick={() => speech.speakAs(chunk.example, settings.language)}
                  >
                    <Icon name="play" className="glyph" />
                  </button>
                  <span>
                    <strong className="en">{chunk.target}</strong> <span className="muted">— {chunk.es}</span>
                    <br />
                    <span className="en small">{chunk.example}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {contrast.length > 0 && (
          <div className="lesson-contrast">
            <h3 className="level">OJO CON EL ESPAÑOL</h3>
            <ul>
              {contrast.map((m, i) => (
                <li key={i}>
                  <s>{m.wrong}</s> → <strong className="en">{m.right}</strong>
                  <span className="muted"> · {m.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {check && <CheckQuestion mistake={check} />}
      </div>
      <p className="muted small">Seleccioná un texto para preguntarle a Claude.</p>
      <SelectionAsk containerRef={contentRef} topicId={view.topicId} />
      <div className="row">
        <button className="btn" disabled={starting} onClick={onStart}>
          {starting ? 'Preparando ejercicios…' : 'Empezar la práctica'}
        </button>
        {starting && (
          <span className="muted">Claude está armando tus ejercicios. Empezás apenas estén los cortos; los largos se suman mientras practicás.</span>
        )}
      </div>
      <ClaudeWait active={starting} />
    </section>
  )
}

// En qué escalón de dificultad está y qué falta para subir.
function DifficultyNote({ state }: { state: DifficultyState }): React.JSX.Element {
  const top = state.difficulty === 'harder'
  return (
    <p className="muted small">
      Dificultad: <strong>{DIFFICULTY_LABELS[state.difficulty]}</strong>
      {top
        ? '. Es el escalón más alto.'
        : ` · sube cuando aciertes el ${Math.round(STEP_UP_RATIO * 100)} % en ${STEP_UP_STREAK} prácticas seguidas (llevás ${state.streak} de ${STEP_UP_STREAK}).`}
    </p>
  )
}

// Una pregunta para comprobar que se entendió: cuál de las dos está bien. No cuenta para nada.
function CheckQuestion({ mistake }: { mistake: Mistake }): React.JSX.Element {
  const options = useMemo(() => (Math.random() < 0.5 ? [mistake.right, mistake.wrong] : [mistake.wrong, mistake.right]), [mistake])
  const [picked, setPicked] = useState<number | null>(null)
  const right = picked !== null && options[picked] === mistake.right
  return (
    <div className="lesson-check">
      <h3 className="level">¿LO ENTENDISTE?</h3>
      <p>¿Cuál está bien?</p>
      <OptionList
        options={options}
        selected={picked}
        correctText={picked !== null ? mistake.right : null}
        locked={picked !== null}
        onSelect={setPicked}
      />
      {picked !== null && (
        <p className={`fade-in ${right ? 'ok-text' : 'warn-text'}`} role="status">
          {right ? '¡Bien! ' : 'Casi: es la otra. '}
          {mistake.why}
        </p>
      )}
    </div>
  )
}
