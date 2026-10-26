import { useState } from 'react'
import { OptionList, QuestionList, type ItemProps } from './common'

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
  return (
    <>
      <div className="reading-text">{content.text}</div>
      <QuestionList
        questions={content.questions}
        initial={answer?.type === 'reading' ? answer.choices : null}
        feedback={feedback}
        locked={feedback !== null || !!locked}
        onAnswer={(choices) => onChange(choices ? { type: 'reading', choices } : null)}
      />
    </>
  )
}
