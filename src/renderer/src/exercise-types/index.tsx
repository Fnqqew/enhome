// La pantalla de cada tipo de ejercicio. Un tipo nuevo se anota acá con su componente.

import type { ComponentType } from 'react'
import type { ExerciseType, PublicExercise } from '@shared/exercises'
import { MultipleChoice, Reading } from './choice'
import type { InputProps, ItemProps } from './common'
import { Dictation, Listening, MinimalPair, Shadowing } from './listening'
import { Dialogue, RolePlay, Writing } from './production'
import { ErrorCorrection, FillBlank, WordOrder } from './sentence'
import { ReorderText, Transformation } from './transform'
import { Translation, TranslationSet } from './translation'

const INPUTS: { [T in ExerciseType]: ComponentType<ItemProps<T>> } = {
  multiple_choice: MultipleChoice,
  fill_blank: FillBlank,
  word_order: WordOrder,
  error_correction: ErrorCorrection,
  translation: Translation,
  translation_set: TranslationSet,
  dialogue: Dialogue,
  roleplay: RolePlay,
  reading: Reading,
  writing: Writing,
  dictation: Dictation,
  listening: Listening,
  minimal_pair: MinimalPair,
  shadowing: Shadowing,
  transformation: Transformation,
  reorder_text: ReorderText
}

export default function ExerciseInput(props: InputProps): React.JSX.Element {
  const Input = INPUTS[props.content.type] as ComponentType<InputProps>
  return <Input {...props} />
}

export type { InputProps } from './common'

// Lo que se puede escuchar del enunciado antes de responder (solo lo que está en el idioma del curso
// y no es la respuesta). Los de escuchar ya traen su audio; los de traducir parten del español.
export function promptAudio(content: PublicExercise): string | null {
  const blank = (text: string): string => text.replace(/_{2,}/g, '…')
  switch (content.type) {
    case 'multiple_choice':
      return blank(content.prompt)
    case 'fill_blank':
      return blank(content.sentence)
    case 'error_correction':
      return content.sentence
    case 'transformation':
      return content.source
    case 'reading':
      return content.text
    default:
      return null
  }
}
