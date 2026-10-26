import { useState } from 'react'
import { OptionList, type ItemProps } from './common'

export function MultipleChoice({ content, answer, feedback, locked, onChange }: ItemProps<'multiple_choice'>): React.JSX.Element {
  const [choice, setChoice] = useState<number | null>(answer?.type === 'multiple_choice' ? answer.choice : null)
  return (
    <>
      <p className="prompt">{content.prompt}</p>
      <OptionList
        options={content.options}
        selected={choice}
        correctText={feedback?.correctAnswer ?? null}
        locked={feedback !== null || !!locked}
        onSelect={(i) => {
          setChoice(i)
          onChange({ type: 'multiple_choice', choice: i })
        }}
      />
    </>
  )
}

export function Reading({ content, answer, feedback, locked, onChange }: ItemProps<'reading'>): React.JSX.Element {
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
            locked={feedback !== null || !!locked}
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
