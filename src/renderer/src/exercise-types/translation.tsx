import { useState } from 'react'
import { useCourse } from '../hooks/useCourse'
import { PartResult, partClass, resultClass, useParts, type ItemProps } from './common'

export function Translation({ content, answer, feedback, locked, onChange }: ItemProps<'translation'>): React.JSX.Element {
  const lang = useCourse().name
  const [text, setText] = useState(answer?.type === 'translation' ? answer.text : '')
  return (
    <>
      <p className="prompt">«{content.spanish}»</p>
      <input
        className={`text-answer${resultClass(feedback)}`}
        value={text}
        disabled={feedback !== null || !!locked}
        placeholder={`Escribí la traducción en ${lang}`}
        autoFocus
        aria-label="Traducción"
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.trim() ? { type: 'translation', text: e.target.value } : null)
        }}
      />
    </>
  )
}

export function TranslationSet({ content, answer, feedback, locked, onChange }: ItemProps<'translation_set'>): React.JSX.Element {
  const lang = useCourse().name
  const initial = answer?.type === 'translation_set' ? answer.texts : null
  const [texts, update] = useParts(content.sentences.length, initial, 'translation_set', onChange)

  return (
    <>
      <p className="situation">{content.situation}</p>
      <ol className="part-list">
        {content.sentences.map((sentence, i) => (
          <li key={i} className="part">
            <p className="part-cue">«{sentence.spanish}»</p>
            <input
              className={`text-answer${partClass(feedback, i)}`}
              value={texts[i]}
              disabled={feedback !== null || !!locked}
              placeholder={`En ${lang}…`}
              autoFocus={i === 0}
              aria-label={`Traducción ${i + 1}`}
              onChange={(e) => update(i, e.target.value)}
            />
            <PartResult feedback={feedback} index={i} />
          </li>
        ))}
      </ol>
    </>
  )
}
