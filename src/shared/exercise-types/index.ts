// Todos los tipos de ejercicio y lo que se hace con cualquiera de ellos sin saber cuál es.

import type { ExerciseAnswer, ExerciseType, GeneratedExercise, PublicExercise, StoredExercise } from '../exercises'
import type { AutoGrade, ExerciseKind, GuideContext, ReviewContext } from './kind'
import { EXERCISE_KINDS } from './registry'

export { EXERCISE_KINDS }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKind = ExerciseKind<any, any, any, any>

export function kindOf(type: ExerciseType): AnyKind {
  return EXERCISE_KINDS[type] as AnyKind
}

export function prepareExercise(exercise: GeneratedExercise, random: () => number = Math.random): StoredExercise {
  return kindOf(exercise.type).prepare(exercise, random) as StoredExercise
}

export function toPublicExercise(exercise: StoredExercise): PublicExercise {
  return kindOf(exercise.type).toPublic(exercise) as PublicExercise
}

export function mainText(exercise: StoredExercise): string {
  return kindOf(exercise.type).mainText(exercise)
}

// Corrige lo que se puede corregir sin Claude; la traducción que no coincide y la escritura van a Claude.
export function gradeAuto(exercise: StoredExercise, answer: ExerciseAnswer): AutoGrade {
  if (exercise.type !== answer.type) throw new Error('La respuesta no corresponde al tipo de ejercicio.')
  return kindOf(exercise.type).grade(exercise, answer)
}

export function emptyAnswer(exercise: StoredExercise): ExerciseAnswer {
  return kindOf(exercise.type).empty(exercise) as ExerciseAnswer
}

export function buildHint(exercise: StoredExercise): string {
  return kindOf(exercise.type).hint(exercise)
}

// Lo que se le dice al alumno para el segundo intento, o null si el tipo no lo tiene.
export function retryNote(exercise: StoredExercise, answer: ExerciseAnswer): string | null {
  const kind = kindOf(exercise.type)
  return kind.retry && exercise.type === answer.type ? kind.retry(exercise, answer) : null
}

export const canRetry = (type: ExerciseType): boolean => !!kindOf(type).retry

// Cómo es cada formato, para pedirle ejercicios a Claude.
export function formatGuide(context: GuideContext, types?: ExerciseType[]): string {
  const kinds = types ? types.map(kindOf) : (Object.values(EXERCISE_KINDS) as AnyKind[])
  return `Formatos (el campo type indica cuál es):
${kinds.map((kind) => `- ${kind.guide(context)}`).join('\n')}
Todas las instruction van en español y son breves. Toda explanation va en español, en una o dos oraciones, y explica la regla.`
}

// Lo que controla el revisor en cada formato.
export function reviewChecks(): string {
  return Object.values(EXERCISE_KINDS)
    .map((kind) => `- ${(kind as AnyKind).check}`)
    .join('\n')
}

export function reviewPrompt(exercise: StoredExercise, context: ReviewContext): string {
  const kind = kindOf(exercise.type)
  if (!kind.review) throw new Error(`Claude no corrige ejercicios de tipo ${exercise.type}.`)
  return kind.review(exercise, context)
}

export function partSources(exercise: StoredExercise): { cue: string; expected: string }[] {
  return kindOf(exercise.type).parts?.(exercise) ?? []
}

export function modelAnswer(exercise: StoredExercise): string | null {
  return kindOf(exercise.type).model?.(exercise) ?? null
}

export type { AutoGrade, ExerciseKind, GuideContext, ReviewContext } from './kind'
