import { useState } from 'react'
import { resultClass, type ItemProps } from './common'

export function FillBlank({ content, answer, feedback, onChange }: ItemProps<'fill_blank'>): React.JSX.Element {
  const [text, setText] = useState(answer?.type === 'fill_blank' ? answer.text : '')
  const [before, after] = content.sentence.split('___')
  return (
    <>
      <p className="prompt">
        {before}
        <input
          className={`blank${resultClass(feedback)}`}
          value={text}
          disabled={feedback !== null}
          size={Math.max(6, text.length + 1)}
          autoFocus
          aria-label="Respuesta"
          onChange={(e) => {
            setText(e.target.value)
            onChange(e.target.value.trim() ? { type: 'fill_blank', text: e.target.value } : null)
          }}
        />
        {after}
      </p>
      {content.hint && <p className="muted">Pista: {content.hint}</p>}
    </>
  )
}

export function WordOrder({ content, answer, feedback, onChange }: ItemProps<'word_order'>): React.JSX.Element {
  const [chosen, setChosen] = useState<number[]>(() => {
    if (answer?.type !== 'word_order') return []
    const used = new Set<number>()
    return answer.tokens.flatMap((token) => {
      const index = content.tokens.findIndex((t, i) => t === token && !used.has(i))
      if (index < 0) return []
      used.add(index)
      return [index]
    })
  })
  const locked = feedback !== null

  const update = (next: number[]): void => {
    setChosen(next)
    onChange(next.length === content.tokens.length ? { type: 'word_order', tokens: next.map((i) => content.tokens[i]) } : null)
  }

  return (
    <>
      <div className={`answer-line${resultClass(feedback)}`}>
        {chosen.length === 0 ? (
          <span className="muted">Tocá las palabras en orden</span>
        ) : (
          chosen.map((index, position) => (
            <button
              key={position}
              type="button"
              className="token"
              disabled={locked}
              aria-label={`Quitar «${content.tokens[index]}»`}
              onClick={() => update(chosen.filter((_, p) => p !== position))}
            >
              {content.tokens[index]}
            </button>
          ))
        )}
      </div>
      <div className="token-bank">
        {content.tokens.map((token, i) =>
          chosen.includes(i) ? null : (
            <button
              key={i}
              type="button"
              className="token"
              disabled={locked}
              aria-label={`Agregar «${token}»`}
              onClick={() => update([...chosen, i])}
            >
              {token}
            </button>
          )
        )}
      </div>
      <p className="muted">Significa: {content.translation}</p>
    </>
  )
}

export function ErrorCorrection({ content, answer, feedback, onChange }: ItemProps<'error_correction'>): React.JSX.Element {
  const [text, setText] = useState(answer?.type === 'error_correction' ? answer.text : content.sentence)
  return (
    <>
      <p className="prompt">{content.sentence}</p>
      <input
        className={`text-answer${resultClass(feedback)}`}
        value={text}
        disabled={feedback !== null}
        autoFocus
        aria-label="Oración corregida"
        onChange={(e) => {
          setText(e.target.value)
          const changed = e.target.value.trim() && e.target.value.trim() !== content.sentence.trim()
          onChange(changed ? { type: 'error_correction', text: e.target.value } : null)
        }}
      />
    </>
  )
}
