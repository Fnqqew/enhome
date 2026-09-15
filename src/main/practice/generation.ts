// Generación con Claude de los ejercicios de una práctica.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import { generatedExerciseSchema, type ExerciseType, type StoredExercise } from '../../shared/exercises'
import type { UnitKind } from '../../shared/progress'
import { askClaude } from '../claude/bridge'
import { SESSION_SIZE } from './composition'
import { prepareExercise } from './exercises'

export interface PoolRequest {
  topic: CurriculumTopic
  subtopic: Subtopic
  kind: UnitKind
  counts: Partial<Record<ExerciseType, number>>
  // Textos de ejercicios anteriores del mismo subtema, para no repetirlos.
  avoid: string[]
}

export type PoolGenerator = (request: PoolRequest) => Promise<StoredExercise[]>

const GENERATION_TIMEOUT_MS = 240_000
const MAX_ATTEMPTS = 2

const SYSTEM_PROMPT =
  'Sos un docente de inglés para hispanohablantes de Argentina. Diseñás ejercicios de práctica claros, graduados y sin ambigüedades. Respondé solo con el JSON pedido.'

const KIND_GUIDE: Record<UnitKind, string> = {
  lesson: 'Es la práctica del día en que el alumno trabaja este subtema. Empezá por lo más simple y subí la dificultad de a poco.',
  focus:
    'Es una práctica de refuerzo: el alumno reprobó el examen de este tópico. Insistí en los puntos clave y en los errores comunes, con ejercicios guiados.',
  review: 'Es un repaso: ejercicios variados y breves que mezclen los puntos clave del subtema.'
}

const FORMAT_GUIDE = `Formatos (el campo type indica cuál es):
- multiple_choice: prompt en inglés (marcá el hueco con ___ si corresponde); 4 opciones con una sola correcta; correctIndex es su posición (0 a 3).
- fill_blank: sentence en inglés con exactamente un ___; hint con una pista breve entre paréntesis, como "(be)", o vacío; answers con todas las variantes válidas, con y sin contracción.
- word_order: sentence es una oración correcta en inglés de 4 a 10 palabras (el alumno la arma con las palabras mezcladas); alternatives con otros órdenes válidos o vacío; translation es su traducción al español.
- error_correction: sentence en inglés con un solo error relacionado con el subtema; answers con la oración corregida y sus variantes válidas.
- translation: spanish es una oración en español rioplatense para traducir al inglés; answers con 1 a 3 traducciones correctas.
- reading: text de 50 a 90 palabras en inglés con 2 o 3 preguntas de opción múltiple (4 opciones, una correcta).
- writing: task en español con una consigna concreta y realista; minWords y maxWords acordes al nivel (A1: entre 20 y 50; A2: entre 40 y 80); guidance con 2 a 4 puntos de qué incluir; sampleAnswer con una respuesta modelo en inglés.
Todas las instruction van en español y son breves. Toda explanation va en español, en una o dos oraciones, y explica la regla.`

export function buildPoolPrompt({ topic, subtopic, kind, counts, avoid }: PoolRequest): string {
  const requested = Object.entries(counts)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join('\n')
  const examples = subtopic.examples.map((e) => `- ${e.en} (${e.es})`).join('\n')
  const mistakes = subtopic.commonMistakes.map((m) => `- "${m.wrong}" → "${m.right}": ${m.why}`).join('\n')

  return `Tópico: ${topic.title} (${topic.titleEn}), nivel ${topic.level}.
Subtema: ${subtopic.title}. Objetivo: ${subtopic.goal}
Puntos clave:
${subtopic.keyPoints.map((p) => `- ${p}`).join('\n')}
Ejemplos:
${examples}
${mistakes ? `Errores comunes:\n${mistakes}\n` : ''}
${KIND_GUIDE[kind]}

Generá exactamente estos ejercicios, en este orden:
${requested}

${FORMAT_GUIDE}

Usá vocabulario acorde al nivel ${topic.level}, con situaciones cotidianas y variadas.${
    avoid.length > 0 ? `\nNo repitas estas oraciones o consignas que el alumno ya practicó:\n${avoid.map((a) => `- ${a}`).join('\n')}` : ''
  }`
}

export async function generatePracticePool(request: PoolRequest): Promise<StoredExercise[]> {
  const schema = z.object({ exercises: z.array(generatedExerciseSchema).min(SESSION_SIZE) })

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { exercises } = await askClaude({
        systemPrompt: SYSTEM_PROMPT,
        prompt: buildPoolPrompt(request),
        schema,
        timeoutMs: GENERATION_TIMEOUT_MS
      })
      // Un ejercicio mal armado se descarta en lugar de romper toda la práctica.
      const prepared = exercises.flatMap((e) => {
        try {
          return [prepareExercise(e)]
        } catch {
          return []
        }
      })
      const missing = (Object.keys(request.counts) as ExerciseType[]).filter((type) => !prepared.some((e) => e.type === type))
      if (prepared.length <= SESSION_SIZE || missing.length > 0) {
        throw new Error(`Claude no generó suficientes ejercicios${missing.length > 0 ? ` (faltan: ${missing.join(', ')})` : ''}.`)
      }
      return prepared
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
