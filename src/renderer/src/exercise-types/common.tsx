// Piezas que comparten las pantallas de los ejercicios.

import { useState } from 'react'
import type { ExerciseAnswer, ExerciseFeedback, PublicExercise } from '@shared/exercises'
import Icon from '../components/Icon'

export type Content<T extends PublicExercise['type']> = Extract<PublicExercise, { type: T }>

export interface InputProps {
  content: PublicExercise
  answer: ExerciseAnswer | null
  feedback: ExerciseFeedback | null
  // Ya respondido y esperando la corrección: se ve pero no se edita.
  locked?: boolean
  // null mientras la respuesta no está completa.
  onChange: (answer: ExerciseAnswer | null) => void
}

export interface ItemProps<T extends PublicExercise['type']> extends Omit<InputProps, 'content'> {
  content: Content<T>
}

export const resultClass = (feedback: ExerciseFeedback | null): string => (feedback ? (feedback.correct ? ' correct' : ' wrong') : '')

export function OptionList({
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
            {state === ' correct' && <span className="sr-only"> (respuesta correcta)</span>}
            {state === ' wrong' && <span className="sr-only"> (tu respuesta, incorrecta)</span>}
          </button>
        )
      })}
    </div>
  )
}

// Preguntas de opción múltiple sobre un texto o una charla: se contestan todas antes de entregar.
export function QuestionList({
  questions,
  initial,
  feedback,
  locked,
  onAnswer
}: {
  questions: { prompt: string; options: string[] }[]
  initial: number[] | null
  feedback: ExerciseFeedback | null
  locked: boolean
  onAnswer: (choices: number[] | null) => void
}): React.JSX.Element {
  const [choices, setChoices] = useState<number[]>(initial ?? questions.map(() => -1))
  const correctLines = feedback?.correctAnswer?.split('\n').map((line) => line.replace(/^\d+\.\s*/, '')) ?? []
  return (
    <>
      {questions.map((question, qi) => (
        <div key={qi} className="stack-sm">
          <p>
            <strong>{qi + 1}.</strong> {question.prompt}
          </p>
          <OptionList
            options={question.options}
            selected={choices[qi] >= 0 ? choices[qi] : null}
            correctText={correctLines[qi] ?? null}
            locked={locked}
            onSelect={(i) => {
              const next = choices.map((c, k) => (k === qi ? i : c))
              setChoices(next)
              onAnswer(next.every((c) => c >= 0) ? next : null)
            }}
          />
        </div>
      ))}
    </>
  )
}

// Las respuestas de a varias partes: se completan todas antes de entregar.
export function useParts(
  count: number,
  initial: string[] | null,
  type: 'translation_set' | 'dialogue' | 'roleplay',
  onChange: InputProps['onChange']
): [string[], (index: number, value: string) => void] {
  const [texts, setTexts] = useState<string[]>(() => Array.from({ length: count }, (_, i) => initial?.[i] ?? ''))
  const update = (index: number, value: string): void => {
    const next = texts.map((t, i) => (i === index ? value : t))
    setTexts(next)
    onChange(next.every((t) => t.trim()) ? ({ type, texts: next } as ExerciseAnswer) : null)
  }
  return [texts, update]
}

export function PartResult({ feedback, index }: { feedback: ExerciseFeedback | null; index: number }): React.JSX.Element | null {
  const part = feedback?.parts?.[index]
  if (!part) return null
  return (
    <div className={`part-result ${part.correct ? 'ok' : 'bad'}`}>
      <span className="part-mark" aria-hidden="true">
        <Icon name={part.correct ? 'check' : 'cross'} className="glyph" />
      </span>
      <div className="stack-sm">
        <p className="en">{part.expected}</p>
        {part.comment && <p className="muted small">{part.comment}</p>}
      </div>
    </div>
  )
}

export function partClass(feedback: ExerciseFeedback | null, index: number): string {
  const part = feedback?.parts?.[index]
  return part ? (part.correct ? ' correct' : ' wrong') : ''
}

export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0)
