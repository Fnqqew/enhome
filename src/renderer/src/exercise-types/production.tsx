import { useEffect, useState } from 'react'
import type { VoiceRole } from '@shared/voice'
import Icon from '../components/Icon'
import { prefetchSpeech, useSpeech } from '../hooks/useSpeech'
import { useSettings } from '../theme/SettingsProvider'
import { useCourse } from '../hooks/useCourse'
import { countWords, PartResult, partClass, useParts, type ItemProps } from './common'

export function Dialogue({ content, answer, feedback, locked, onChange }: ItemProps<'dialogue'>): React.JSX.Element {
  const lang = useCourse().name
  // Número de turno del alumno para cada línea del guion (null en las del otro).
  const turnOf = content.script.reduce<(number | null)[]>((acc, line) => {
    const previous = acc.filter((n) => n !== null).length
    return [...acc, line.role === 'you' ? previous : null]
  }, [])
  const turns = turnOf.filter((n) => n !== null).length
  const initial = answer?.type === 'dialogue' ? answer.texts : null
  const [texts, update] = useParts(turns, initial, 'dialogue', onChange)
  const speech = useSpeech()
  // Lo que se escucha: las líneas del otro con la segunda voz y, ya corregido, tus turnos con la principal.
  const lines = content.script.flatMap((line, i): { text: string; role: VoiceRole }[] => {
    if (line.role === 'other') return [{ text: line.text, role: 'other' }]
    const expected = feedback?.parts?.[turnOf[i]!]?.expected
    return expected ? [{ text: expected, role: 'main' }] : []
  })
  const settingsLang = useSettings().settings.language
  useEffect(() => prefetchSpeech('', settingsLang, lines), [lines.map((l) => l.text).join('|'), settingsLang]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="row spread">
        <p className="situation">{content.situation}</p>
        <button
          type="button"
          className="chip"
          onClick={() => (speech.state === 'playing' ? speech.stop() : speech.speakLines(lines))}
          aria-label={speech.state === 'playing' ? 'Parar' : 'Escuchar la conversación'}
        >
          <Icon name={speech.state === 'playing' ? 'stop' : 'play'} className="glyph" /> {speech.state === 'playing' ? 'Parar' : 'Escuchar'}
        </button>
      </div>
      <div className="chat">
        {content.script.map((line, i) => {
          if (line.role === 'other') {
            return (
              <div key={i} className="chat-line">
                <span className="chat-speaker">{line.speaker}</span>
                <p className="bubble">{line.text}</p>
              </div>
            )
          }
          const index = turnOf[i]!
          return (
            <div key={i} className="chat-line mine">
              <span className="chat-speaker">Vos · {line.cue}</span>
              <input
                className={`text-answer${partClass(feedback, index)}`}
                value={texts[index]}
                disabled={feedback !== null || !!locked}
                placeholder={`Tu respuesta en ${lang}…`}
                autoFocus={index === 0}
                aria-label={`Turno ${index + 1}`}
                onChange={(e) => update(index, e.target.value)}
              />
              <PartResult feedback={feedback} index={index} />
            </div>
          )
        })}
      </div>
    </>
  )
}

export function RolePlay({ content, answer, feedback, locked, onChange }: ItemProps<'roleplay'>): React.JSX.Element {
  const lang = useCourse().name
  const initial = answer?.type === 'roleplay' ? answer.texts : null
  const [texts, update] = useParts(content.steps.length, initial, 'roleplay', onChange)

  return (
    <>
      <p className="situation">{content.situation}</p>
      <p className="goal">
        <strong>Objetivo:</strong> {content.goal}
      </p>
      <ol className="part-list">
        {content.steps.map((step, i) => (
          <li key={i} className="part">
            <p className="part-cue">{step.cue}</p>
            <input
              className={`text-answer${partClass(feedback, i)}`}
              value={texts[i]}
              disabled={feedback !== null || !!locked}
              placeholder={`En ${lang}…`}
              autoFocus={i === 0}
              aria-label={`Paso ${i + 1}`}
              onChange={(e) => update(i, e.target.value)}
            />
            <PartResult feedback={feedback} index={i} />
          </li>
        ))}
      </ol>
    </>
  )
}

export function Writing({ content, answer, feedback, locked, onChange }: ItemProps<'writing'>): React.JSX.Element {
  const lang = useCourse().name
  const [text, setText] = useState(answer?.type === 'writing' ? answer.text : '')
  const words = countWords(text)
  const outOfRange = words > 0 && (words < content.minWords || words > content.maxWords)

  return (
    <>
      <p className="prompt">{content.task}</p>
      <ul className="guidance">
        {content.guidance.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <textarea
        className="text-answer"
        rows={6}
        value={text}
        disabled={feedback !== null || !!locked}
        placeholder={`Escribí tu texto en ${lang}…`}
        aria-label="Texto"
        onChange={(e) => {
          setText(e.target.value)
          onChange(countWords(e.target.value) > 0 ? { type: 'writing', text: e.target.value } : null)
        }}
      />
      <p className={outOfRange ? 'warn-text' : 'muted'}>
        {words} palabras · entre {content.minWords} y {content.maxWords}
      </p>
    </>
  )
}
