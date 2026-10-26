// Producción libre que corrige Claude: conversación, situación real y escritura.

import { z } from 'zod'
import { graded, text, type ExerciseKind } from './kind'
import { firstWords } from './text'

const none = (message: string): ReturnType<typeof graded> => graded(false, null, message)

// Conversación

const line = z.union([
  z.object({ role: z.literal('other'), speaker: text, text: text }),
  z.object({ role: z.literal('you'), cue: text, sample: text })
])
const dialogueGenerated = z.object({
  type: z.literal('dialogue'),
  instruction: text,
  situation: text,
  script: z.array(line).min(4).max(10)
})
type DialogueGenerated = z.infer<typeof dialogueGenerated>
const dialogueAnswer = z.object({ type: z.literal('dialogue'), texts: z.array(z.string().max(500)).max(5) })
type DialogueAnswer = z.infer<typeof dialogueAnswer>
export interface DialoguePublic {
  type: 'dialogue'
  instruction: string
  situation: string
  script: ({ role: 'other'; speaker: string; text: string } | { role: 'you'; cue: string })[]
}

const yourTurns = (e: DialogueGenerated): Extract<DialogueGenerated['script'][number], { role: 'you' }>[] =>
  e.script.flatMap((l) => (l.role === 'you' ? [l] : []))

export const dialogue: ExerciseKind<DialogueGenerated, DialogueGenerated, DialoguePublic, DialogueAnswer> = {
  type: 'dialogue',
  label: 'Conversación',
  skill: 'writing',
  long: true,
  generated: dialogueGenerated,
  answer: dialogueAnswer,
  prepare: (e) => {
    const turns = yourTurns(e)
    if (turns.length < 2) throw new Error('La conversación tiene que dejarle al menos dos turnos al alumno.')
    if (turns.length > 5) throw new Error('La conversación le pide demasiados turnos al alumno.')
    if (!e.script.some((l) => l.role === 'other')) throw new Error('La conversación no tiene a nadie con quien hablar.')
    return e
  },
  toPublic: (e) => ({
    type: e.type,
    instruction: e.instruction,
    situation: e.situation,
    script: e.script.map((l) => (l.role === 'other' ? l : { role: 'you' as const, cue: l.cue }))
  }),
  mainText: (e) => e.situation,
  grade: (_e, a) => (a.texts.every((t) => !t.trim()) ? none('No escribiste ninguna respuesta.') : { kind: 'needs-ai' }),
  empty: (e) => ({ type: e.type, texts: yourTurns(e).map(() => '') }),
  hint: (e) => {
    const first = yourTurns(e)[0]
    return first ? `Tu primer turno puede empezar con «${firstWords(first.sample)}…»` : 'Respondé a lo último que te dijeron.'
  },
  guide: ({ language }) =>
    `dialogue: situation describe en español dónde pasa la charla y con quién; script es la conversación en orden, alternando partes: las del otro con role "other", speaker (el nombre o rol de quien habla) y text en ${language}; las del alumno con role "you", cue (en español, qué tiene que decir, concreto) y sample (una respuesta modelo natural en ${language}). Tiene que haber 2 o 3 turnos del alumno y la charla tiene que cerrar bien.`,
  check: 'dialogue: la conversación tiene sentido de principio a fin, cada cue pide algo concreto y cada sample responde de verdad a lo anterior.',
  review: (e, c) => {
    let turn = 0
    const script = e.script
      .map((l) => {
        if (l.role === 'other') return `${l.speaker}: ${l.text}`
        const i = turn++
        return `Alumno (tenía que: ${l.cue})\n   Respuesta modelo: «${l.sample}»\n   Escribió: ${c.answered(i)}`
      })
      .join('\n')
    return `${c.head}

El alumno completó sus turnos en esta conversación. Situación: ${e.situation}

${script}

Evaluá cada turno del alumno: tiene que responder lo que pide la consigna, sonar natural en una conversación real y usar bien la gramática del subtema. La respuesta modelo es solo una opción válida entre varias.

${c.output}
${c.parts}`
  },
  parts: (e) => yourTurns(e).map((l) => ({ cue: l.cue, expected: l.sample })),
  model: () => null
}

// Situación real

const roleplayGenerated = z.object({
  type: z.literal('roleplay'),
  instruction: text,
  situation: text,
  goal: text,
  steps: z
    .array(z.object({ cue: text, sample: text }))
    .min(3)
    .max(5)
})
type RoleplayGenerated = z.infer<typeof roleplayGenerated>
const roleplayAnswer = z.object({ type: z.literal('roleplay'), texts: z.array(z.string().max(500)).max(5) })
type RoleplayAnswer = z.infer<typeof roleplayAnswer>
export interface RoleplayPublic {
  type: 'roleplay'
  instruction: string
  situation: string
  goal: string
  steps: { cue: string }[]
}

export const roleplay: ExerciseKind<RoleplayGenerated, RoleplayGenerated, RoleplayPublic, RoleplayAnswer> = {
  type: 'roleplay',
  label: 'Situación real',
  skill: 'writing',
  long: true,
  generated: roleplayGenerated,
  answer: roleplayAnswer,
  prepare: (e) => e,
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, situation: e.situation, goal: e.goal, steps: e.steps.map((s) => ({ cue: s.cue })) }),
  mainText: (e) => e.situation,
  grade: (_e, a) => (a.texts.every((t) => !t.trim()) ? none('No escribiste ninguna respuesta.') : { kind: 'needs-ai' }),
  empty: (e) => ({ type: e.type, texts: e.steps.map(() => '') }),
  hint: (e) => `Para el primer paso te sirve empezar con «${firstWords(e.steps[0].sample)}…»`,
  guide: ({ language }) =>
    `roleplay: situation plantea en español una situación real (un trámite, una compra, un reclamo, una presentación); goal es lo que el alumno tiene que conseguir; steps son 3 o 4 pasos en orden, cada uno con cue (qué tiene que decir o preguntar, en español) y sample (cómo se diría en ${language}). Los pasos tienen que avanzar la situación, no repetirse.`,
  check: 'roleplay: los pasos avanzan hacia el objetivo, no se repiten y cada sample es lo que diría un hablante nativo en esa situación.',
  review: (e, c) => `${c.head}

El alumno resolvió una situación simulada. Situación: ${e.situation}
Objetivo: ${e.goal}

${e.steps.map((s, i) => `${i + 1}. Tenía que: ${s.cue}\n   Respuesta modelo: «${s.sample}»\n   Escribió: ${c.answered(i)}`).join('\n')}

Evaluá cada paso: tiene que cumplir lo que pide la consigna, ser apropiado para la situación (registro y cortesía) y usar bien la gramática del subtema. La respuesta modelo es solo una opción válida entre varias.

${c.output}
${c.parts}`,
  parts: (e) => e.steps.map((s) => ({ cue: s.cue, expected: s.sample })),
  model: () => null
}

// Escritura

const writingGenerated = z.object({
  type: z.literal('writing'),
  instruction: text,
  task: text,
  minWords: z.number().int().min(10).max(150),
  maxWords: z.number().int().min(20).max(250),
  guidance: z.array(text).min(1).max(5),
  sampleAnswer: text
})
type WritingGenerated = z.infer<typeof writingGenerated>
const writingAnswer = z.object({ type: z.literal('writing'), text: z.string().max(3000) })
type WritingAnswer = z.infer<typeof writingAnswer>
export interface WritingPublic {
  type: 'writing'
  instruction: string
  task: string
  minWords: number
  maxWords: number
  guidance: string[]
}

// Puntaje mínimo para considerar correcto un texto escrito.
export const WRITING_PASS_SCORE = 6

export const writing: ExerciseKind<WritingGenerated, WritingGenerated, WritingPublic, WritingAnswer> = {
  type: 'writing',
  label: 'Escritura',
  skill: 'writing',
  long: true,
  generated: writingGenerated,
  answer: writingAnswer,
  prepare: (e) => {
    if (e.minWords > e.maxWords) throw new Error('La extensión mínima supera a la máxima.')
    return e
  },
  toPublic: (e) => ({ type: e.type, instruction: e.instruction, task: e.task, minWords: e.minWords, maxWords: e.maxWords, guidance: e.guidance }),
  mainText: (e) => e.task,
  grade: (e, a) => (a.text.trim() ? { kind: 'needs-ai' } : graded(false, e.sampleAnswer, 'No escribiste nada.')),
  empty: (e) => ({ type: e.type, text: '' }),
  hint: (e) => `Una forma de empezar: «${e.sampleAnswer.split(/(?<=[.!?])\s+/)[0]}»`,
  guide: ({ language }) =>
    `writing: task en español con una consigna concreta y realista; minWords y maxWords acordes al nivel (A1: entre 35 y 70; A2: entre 60 y 110; B1: entre 100 y 160; B2: entre 150 y 220; C1 y C2: entre 200 y 250); guidance con 2 a 4 puntos de qué incluir; sampleAnswer con una respuesta modelo en ${language}.`,
  check: 'writing: la consigna es clara, la extensión es acorde al nivel y sampleAnswer no tiene errores.',
  review: (e, c) => `${c.head}

Consigna de escritura: ${e.task}
Qué tenía que incluir:
${e.guidance.map((g) => `- ${g}`).join('\n')}
Extensión pedida: entre ${e.minWords} y ${e.maxWords} palabras.
Respuesta modelo (solo orientativa): «${e.sampleAnswer}»

Texto del alumno:
${c.answered(0)}

Criterios de corrección:
1. Uso correcto de lo que practica el subtema (40 %).
2. Gramática y ortografía en general (25 %).
3. Cumple la consigna y los puntos pedidos (25 %).
4. Vocabulario y claridad acordes al nivel ${c.level} (10 %).
Si la extensión está muy por fuera de lo pedido, mencionalo y descontá en el criterio 3.

${c.output}`,
  model: (e) => e.sampleAnswer,
  passScore: WRITING_PASS_SCORE
}
