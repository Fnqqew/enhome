// La lista de tipos de ejercicio. Un tipo nuevo se define en su archivo y se anota acá.

import { multipleChoice, reading } from './choice'
import { dictation, listening, minimalPair, shadowing } from './listening'
import { reorderText, transformation } from './transform'
import { dialogue, roleplay, writing } from './production'
import { errorCorrection, fillBlank, wordOrder } from './sentence'
import { translation, translationSet } from './translation'

export {
  dialogue,
  dictation,
  errorCorrection,
  fillBlank,
  listening,
  minimalPair,
  multipleChoice,
  reading,
  reorderText,
  roleplay,
  shadowing,
  transformation,
  translation,
  translationSet,
  wordOrder,
  writing
}

export const EXERCISE_KINDS = {
  multiple_choice: multipleChoice,
  fill_blank: fillBlank,
  word_order: wordOrder,
  error_correction: errorCorrection,
  translation,
  translation_set: translationSet,
  dialogue,
  roleplay,
  reading,
  writing,
  dictation,
  listening,
  minimal_pair: minimalPair,
  shadowing,
  transformation,
  reorder_text: reorderText
} as const
