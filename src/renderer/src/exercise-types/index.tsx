// La pantalla de cada tipo de ejercicio. Un tipo nuevo se anota acá con su componente.

import type { ComponentType } from 'react'
import type { ExerciseType } from '@shared/exercises'
import { MultipleChoice, Reading } from './choice'
import type { InputProps, ItemProps } from './common'
import { Dialogue, RolePlay, Writing } from './production'
import { ErrorCorrection, FillBlank, WordOrder } from './sentence'
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
  writing: Writing
}

export default function ExerciseInput(props: InputProps): React.JSX.Element {
  const Input = INPUTS[props.content.type] as ComponentType<InputProps>
  return <Input {...props} />
}

export type { InputProps } from './common'
