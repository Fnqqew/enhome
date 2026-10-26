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
// Los campos de un esquema, con sus nombres, para escribirlos en el pedido: Claude Code no siempre hace
// respetar el esquema y, sin los nombres a la vista, a veces omite campos o los renombra.
export function fieldsOf(schema: unknown): string {
  const def = (schema as { _zod?: { def?: Record<string, unknown> } })._zod?.def
  if (!def) return '…'
  switch (def.type) {
    case 'object': {
      const shape = def.shape as Record<string, unknown>
      const fields = Object.entries(shape).map(([key, value]) => {
        const optional = (value as { _zod?: { def?: { type?: string } } })._zod?.def?.type === 'optional'
        const inner = fieldsOf(value)
        return `${key}${optional ? '?' : ''}${inner === '…' ? '' : `: ${inner}`}`
      })
      return `{ ${fields.join(', ')} }`
    }
    case 'array':
      return `[${fieldsOf(def.element)}]`
    case 'tuple':
      return `[${(def.items as unknown[]).map(fieldsOf).join(', ')}]`
    case 'optional':
    case 'nullable':
    case 'default':
      return fieldsOf(def.innerType)
    case 'pipe':
      return fieldsOf(def.in)
    case 'literal':
      return JSON.stringify((def.values as unknown[])[0])
    case 'number':
      return 'número'
    default:
      return '…'
  }
}

export function formatGuide(context: GuideContext, types?: ExerciseType[]): string {
  const kinds = types ? types.map(kindOf) : (Object.values(EXERCISE_KINDS) as AnyKind[])
  return `Formatos (el campo type indica cuál es):
${kinds.map((kind) => `- ${kind.guide(context)}\n  Campos, con estos nombres exactos (? es opcional): ${fieldsOf(kind.generated)}`).join('\n')}
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
