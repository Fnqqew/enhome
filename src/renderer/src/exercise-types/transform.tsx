import { useState } from 'react'
import { useCourse } from '../hooks/useCourse'
import { resultClass, type ItemProps } from './common'

export function Transformation({ content, answer, feedback, locked, onChange }: ItemProps<'transformation'>): React.JSX.Element {
  const lang = useCourse().name
  const [text, setText] = useState(answer?.type === 'transformation' ? answer.text : '')
  return (
    <>
      <p className="prompt">{content.source}</p>
      <input
        className={`text-answer${resultClass(feedback)}`}
        value={text}
        disabled={feedback !== null || !!locked}
        placeholder={`La oración transformada, en ${lang}`}
        autoFocus
        aria-label="Oración transformada"
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.trim() ? { type: 'transformation', text: e.target.value } : null)
        }}
      />
    </>
  )
}

// Se tocan las oraciones en el orden en que van; tocar una ya puesta la devuelve.
export function ReorderText({ content, answer, feedback, locked, onChange }: ItemProps<'reorder_text'>): React.JSX.Element {
  const [chosen, setChosen] = useState<number[]>(answer?.type === 'reorder_text' ? answer.order : [])
  const frozen = feedback !== null || !!locked

  const update = (next: number[]): void => {
    setChosen(next)
    onChange(next.length === content.pieces.length ? { type: 'reorder_text', order: next } : null)
  }

  return (
    <>
      <ol className={`reorder-text${resultClass(feedback)}`}>
        {chosen.length === 0 ? (
          <li className="muted">Tocá las oraciones en el orden en que van</li>
        ) : (
          chosen.map((index, position) => (
            <li key={index}>
              <button type="button" className="sentence-piece" disabled={frozen} onClick={() => update(chosen.filter((_, p) => p !== position))}>
                {content.pieces[index]}
              </button>
            </li>
          ))
        )}
      </ol>
      {!frozen && (
        <div className="stack-sm">
          {content.pieces.map((piece, i) =>
            chosen.includes(i) ? null : (
              <button key={i} type="button" className="sentence-piece" onClick={() => update([...chosen, i])}>
                {piece}
              </button>
            )
          )}
        </div>
      )}
    </>
  )
}
