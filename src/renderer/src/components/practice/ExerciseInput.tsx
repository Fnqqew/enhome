import { useState } from 'react'
import type { ExerciseAnswer, ExerciseFeedback, PublicExercise } from '@shared/exercises'

type Content<T extends PublicExercise['type']> = Extract<PublicExercise, { type: T }>

interface Props {
  content: PublicExercise
  answer: ExerciseAnswer | null
  feedback: ExerciseFeedback | null
  // null mientras la respuesta no está completa.
  onChange: (answer: ExerciseAnswer | null) => void
}

interface ItemProps<T extends PublicExercise['type']> extends Omit<Props, 'content'> {
  content: Content<T>
}

export default function ExerciseInput(props: Props): React.JSX.Element {
  const { content } = props
  switch (content.type) {
    case 'multiple_choice':
      return <MultipleChoice {...props} content={content} />
    case 'fill_blank':
      return <FillBlank {...props} content={content} />
    case 'word_order':
      return <WordOrder {...props} content={content} />
    case 'error_correction':
      return <ErrorCorrection {...props} content={content} />
    case 'translation':
      return <Translation {...props} content={content} />
    case 'translation_set':
      return <TranslationSet {...props} content={content} />
    case 'dialogue':
      return <Dialogue {...props} content={content} />
    case 'roleplay':
      return <RolePlay {...props} content={content} />
    case 'reading':
      return <Reading {...props} content={content} />
    case 'writing':
      return <Writing {...props} content={content} />
  }
}

const resultClass = (feedback: ExerciseFeedback | null): string => (feedback ? (feedback.correct ? ' correct' : ' wrong') : '')

function OptionList({
  options,
  selected,
  correctText,
  locked,
  onSelect
}: {
  options: string[]
  selected: number | null
  correctText: string | null
  locked: boolean
  onSelect: (index: number) => void
}): React.JSX.Element {
  return (
    <div className="options">
      {options.map((option, i) => {
        const state = !locked ? '' : option === correctText ? ' correct' : i === selected ? ' wrong' : ''
        return (
          <button key={i} type="button" className={`option${state}`} aria-pressed={selected === i} disabled={locked} onClick={() => onSelect(i)}>
            {option}
          </button>
        )
      })}
    </div>
  )
}

function MultipleChoice({ content, answer, feedback, onChange }: ItemProps<'multiple_choice'>): React.JSX.Element {
  const [choice, setChoice] = useState<number | null>(answer?.type === 'multiple_choice' ? answer.choice : null)
  return (
    <>
      <p className="prompt">{content.prompt}</p>
      <OptionList
        options={content.options}
        selected={choice}
        correctText={feedback?.correctAnswer ?? null}
        locked={feedback !== null}
        onSelect={(i) => {
          setChoice(i)
          onChange({ type: 'multiple_choice', choice: i })
        }}
      />
    </>
  )
}

function FillBlank({ content, answer, feedback, onChange }: ItemProps<'fill_blank'>): React.JSX.Element {
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

function WordOrder({ content, answer, feedback, onChange }: ItemProps<'word_order'>): React.JSX.Element {
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
            <button key={position} type="button" className="token" disabled={locked} onClick={() => update(chosen.filter((_, p) => p !== position))}>
              {content.tokens[index]}
            </button>
          ))
        )}
      </div>
      <div className="token-bank">
        {content.tokens.map((token, i) =>
          chosen.includes(i) ? null : (
            <button key={i} type="button" className="token" disabled={locked} onClick={() => update([...chosen, i])}>
              {token}
            </button>
          )
        )}
      </div>
      <p className="muted">Significa: {content.translation}</p>
    </>
  )
}

function ErrorCorrection({ content, answer, feedback, onChange }: ItemProps<'error_correction'>): React.JSX.Element {
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

function Translation({ content, answer, feedback, onChange }: ItemProps<'translation'>): React.JSX.Element {
  const [text, setText] = useState(answer?.type === 'translation' ? answer.text : '')
  return (
    <>
      <p className="prompt">«{content.spanish}»</p>
      <input
        className={`text-answer${resultClass(feedback)}`}
        value={text}
        disabled={feedback !== null}
        placeholder="Escribí la traducción en inglés"
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

// Las respuestas de a varias partes: se completan todas antes de entregar.
function useParts(
  count: number,
  initial: string[] | null,
  type: 'translation_set' | 'dialogue' | 'roleplay',
  onChange: Props['onChange']
): [string[], (index: number, value: string) => void] {
  const [texts, setTexts] = useState<string[]>(() => Array.from({ length: count }, (_, i) => initial?.[i] ?? ''))
  const update = (index: number, value: string): void => {
    const next = texts.map((t, i) => (i === index ? value : t))
    setTexts(next)
    onChange(next.every((t) => t.trim()) ? ({ type, texts: next } as ExerciseAnswer) : null)
  }
  return [texts, update]
}

function PartResult({ feedback, index }: { feedback: ExerciseFeedback | null; index: number }): React.JSX.Element | null {
  const part = feedback?.parts?.[index]
  if (!part) return null
  return (
    <div className={`part-result ${part.correct ? 'ok' : 'bad'}`}>
      <span className="part-mark" aria-hidden="true">
        {part.correct ? '✓' : '✗'}
      </span>
      <div className="stack-sm">
        <p className="en">{part.expected}</p>
        {part.comment && <p className="muted small">{part.comment}</p>}
      </div>
    </div>
  )
}

function partClass(feedback: ExerciseFeedback | null, index: number): string {
  const part = feedback?.parts?.[index]
  return part ? (part.correct ? ' correct' : ' wrong') : ''
}

function TranslationSet({ content, answer, feedback, onChange }: ItemProps<'translation_set'>): React.JSX.Element {
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
              disabled={feedback !== null}
              placeholder="En inglés…"
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

function Dialogue({ content, answer, feedback, onChange }: ItemProps<'dialogue'>): React.JSX.Element {
  // Número de turno del alumno para cada línea del guion (null en las del otro).
  const turnOf = content.script.reduce<(number | null)[]>((acc, line) => {
    const previous = acc.filter((n) => n !== null).length
    return [...acc, line.role === 'you' ? previous : null]
  }, [])
  const turns = turnOf.filter((n) => n !== null).length
  const initial = answer?.type === 'dialogue' ? answer.texts : null
  const [texts, update] = useParts(turns, initial, 'dialogue', onChange)

  return (
    <>
      <p className="situation">{content.situation}</p>
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
                disabled={feedback !== null}
                placeholder="Tu respuesta en inglés…"
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

function RolePlay({ content, answer, feedback, onChange }: ItemProps<'roleplay'>): React.JSX.Element {
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
              disabled={feedback !== null}
              placeholder="En inglés…"
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

function Reading({ content, answer, feedback, onChange }: ItemProps<'reading'>): React.JSX.Element {
  const [choices, setChoices] = useState<number[]>(answer?.type === 'reading' ? answer.choices : content.questions.map(() => -1))
  const correctLines = feedback?.correctAnswer?.split('\n').map((line) => line.replace(/^\d+\.\s*/, '')) ?? []

  return (
    <>
      <div className="reading-text">{content.text}</div>
      {content.questions.map((question, qi) => (
        <div key={qi} className="stack-sm">
          <p>
            <strong>{qi + 1}.</strong> {question.prompt}
          </p>
          <OptionList
            options={question.options}
            selected={choices[qi] >= 0 ? choices[qi] : null}
            correctText={correctLines[qi] ?? null}
            locked={feedback !== null}
            onSelect={(i) => {
              const next = choices.map((c, k) => (k === qi ? i : c))
              setChoices(next)
              onChange(next.every((c) => c >= 0) ? { type: 'reading', choices: next } : null)
            }}
          />
        </div>
      ))}
    </>
  )
}

const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0)

function Writing({ content, answer, feedback, onChange }: ItemProps<'writing'>): React.JSX.Element {
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
        disabled={feedback !== null}
        placeholder="Escribí tu texto en inglés…"
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
