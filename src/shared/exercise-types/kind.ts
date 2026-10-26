// Qué tiene cada tipo de ejercicio. Sumar un formato es escribir uno de estos (y su pantalla en
// renderer/src/exercise-types) y anotarlo en index.ts.

import { z } from 'zod'
import type { Skill } from '../curriculum'
import type { ExerciseFeedback } from '../exercises'

export const text = z.string().trim().min(1)
export const choiceIndex = z.number().int().min(0).max(3)

export type AutoGrade = { kind: 'graded'; feedback: ExerciseFeedback } | { kind: 'needs-ai' }

export const graded = (correct: boolean, correctAnswer: string | null, explanation: string, score = correct ? 10 : 0): AutoGrade => ({
  kind: 'graded',
  feedback: { correct, score, correctAnswer, explanation }
})

export interface GuideContext {
  // Nombre del idioma del curso («inglés») y de la variante del español de las consignas.
  language: string
  spanish: string
}

export interface ReviewContext {
  // Tópico, subtema y puntos clave, ya armados.
  head: string
  // Idioma del curso («inglés»).
  target: string
  level: string
  // La respuesta del alumno en la parte i, entre comillas, o «(no escribió nada)».
  answered: (index: number) => string
  // Qué tiene que devolver Claude, y lo que se agrega cuando hay varias partes.
  output: string
  parts: string
}

// G: lo que genera Claude · S: lo que se guarda · P: lo que ve el alumno · A: cómo responde.
export interface ExerciseKind<
  G extends { type: string },
  S extends { type: G['type'] },
  P extends { type: G['type'] },
  A extends { type: G['type'] }
> {
  type: G['type']
  label: string
  skill: Skill
  // Los largos se responden en varias partes y los corrige Claude.
  long: boolean
  generated: z.ZodType<G>
  answer: z.ZodType<A>
  // Controles que el esquema no garantiza y mezcla de opciones o palabras. Lanza si el ejercicio no sirve.
  prepare: (exercise: G, random: () => number) => S
  toPublic: (exercise: S) => P
  // El texto principal, para pedirle a Claude que no lo repita.
  mainText: (exercise: S) => string
  // Corrección sin Claude; 'needs-ai' si hace falta Claude.
  grade: (exercise: S, answer: A) => AutoGrade
  // La respuesta de una pregunta sin contestar (siempre queda mal, sin Claude).
  empty: (exercise: S) => A
  // Pista que ayuda sin revelar la respuesta (se paga con un comodín).
  hint: (exercise: S) => string
  // Cómo se le describe el formato a Claude y qué controla el revisor.
  guide: (context: GuideContext) => string
  check: string
  // Solo los que puede corregir Claude.
  review?: (exercise: S, context: ReviewContext) => string
  parts?: (exercise: S) => { cue: string; expected: string }[]
  model?: (exercise: S) => string | null
  // Puntaje mínimo de Claude para darlo por bueno (escritura); si no está, vale lo que diga «acceptable».
  passScore?: number
  // Lo que se le muestra al alumno como explicación cuando corrige Claude.
  explanation?: (exercise: S) => string
}

export type StoredOf<K> = K extends ExerciseKind<infer _G, infer S, infer _P, infer _A> ? S : never
export type PublicOf<K> = K extends ExerciseKind<infer _G, infer _S, infer P, infer _A> ? P : never
