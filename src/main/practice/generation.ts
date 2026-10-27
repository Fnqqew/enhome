// Generación con Claude de los ejercicios de una práctica: un docente los genera y un revisor los corrige.
// Se piden en dos tandas, los cortos y los largos, para que ninguna respuesta quede cortada.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import { generatedSchemaFor, LONG_TYPES, type ExerciseType, type GeneratedExercise, type StoredExercise } from '../../shared/exercises'
import type { UnitKind } from '../../shared/progress'
import { askClaude, shouldRetry, type Ask, type Ticket } from '../claude/bridge'
import {
  applyCorrections,
  CORRECTIONS_GUIDE,
  numbered,
  qualityChecklist,
  REVIEW_EFFORT,
  reviewSystemPrompt,
  roleSystemPrompt,
  selfCheck,
  spanish
} from '../claude/quality'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { SESSION_SIZE } from './composition'
import { formatGuide as formatGuideFor, prepareExercise, reviewChecks } from '../../shared/exercise-types'

export interface PoolRequest {
  topic: CurriculumTopic
  subtopic: Subtopic
  kind: UnitKind
  counts: Partial<Record<ExerciseType, number>>
  // Textos de ejercicios anteriores del mismo subtema, para no repetirlos.
  avoid: string[]
  // Se llama con cada tanda apenas está lista (la corta suele llegar un minuto antes que la larga).
  onGroup?: (exercises: StoredExercise[]) => void
  // Ejercicios que tiene la práctica (según la duración elegida).
  size?: number
  // Cómo le viene yendo al alumno en el tópico: sube o baja la exigencia.
  difficulty?: Difficulty
  // Prioridad en la cola de Claude: de fondo al prepararla, urgente cuando el alumno la abre.
  ticket?: Ticket
}

export type Difficulty = 'guided' | 'normal' | 'harder'

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  guided:
    'Al alumno le está costando este tópico: hacé ejercicios más guiados, con oraciones cortas, contexto claro y pistas en la consigna. Que sigan exigiendo lo del subtema, pero de a un paso por vez.',
  normal: '',
  harder:
    'El alumno viene acertando casi todo en este tópico: subí la exigencia con oraciones más largas, vocabulario menos frecuente del nivel, distractores más finos y situaciones que combinen lo de este subtema con lo de los días anteriores.'
}

export type PoolGenerator = (request: PoolRequest) => Promise<StoredExercise[]>

const GENERATION_TIMEOUT_MS = 300_000
const MAX_ATTEMPTS = 2

const systemPrompt = (topic: CurriculumTopic): string =>
  roleSystemPrompt(topic.language, 'docente', 'Diseñás ejercicios de práctica exigentes, realistas y sin ambigüedades.')

// Lo que devuelve Claude, con el esquema de solo los tipos pedidos.
// Lo que devuelve Claude, con el esquema de solo los tipos pedidos. Cada ejercicio se valida por su
// cuenta: uno mal armado se descarta (queda null) en vez de tirar abajo el pedido entero.
const lenient = (types: ExerciseType[]) => generatedSchemaFor(types).catch(null as unknown as GeneratedExercise)
const poolSchema = (types: ExerciseType[]) => z.object({ exercises: z.array(lenient(types)).min(1) })
const reviewSchema = (types: ExerciseType[]) =>
  z.object({
    issues: z.array(z.string()),
    corrections: z.array(
      z
        .object({ index: z.number().int().min(0), replacement: generatedSchemaFor(types) })
        .catch(null as unknown as { index: number; replacement: GeneratedExercise })
    )
  })

// Los ejercicios que pasaron el esquema (avisa en el registro cuántos se descartaron).
function valid<T>(items: (T | null)[], label: string): T[] {
  const kept = items.filter((item): item is T => item !== null)
  if (kept.length < items.length) console.info(`[practice] ${label}: se descartaron ${items.length - kept.length} con formato inválido`)
  return kept
}
const typesOf = (counts: Partial<Record<ExerciseType, number>>): ExerciseType[] => Object.keys(counts) as ExerciseType[]

const KIND_GUIDE: Record<UnitKind, string> = {
  lesson: 'Es la práctica del día en que el alumno trabaja este subtema. Empezá por lo más simple y subí la dificultad de a poco.',
  focus:
    'Es una práctica de refuerzo: el alumno reprobó el examen de este tópico. Insistí en los puntos clave y en los errores comunes, con ejercicios guiados.',
  review: 'Es un repaso: ejercicios variados que mezclen los puntos clave del subtema.'
}

// Cómo es cada formato (lo define cada tipo). El idioma cambia en qué lengua van las oraciones.
export function formatGuide(language: LanguageId, types?: ExerciseType[]): string {
  const info = languageInfo(language)
  const guide = formatGuideFor({ language: info.name, spanish: spanish() }, types)
  // El japonés y el chino no separan palabras: para ordenar, los bloques van separados por espacios.
  return info.script === 'japanese' || info.script === 'chinese'
    ? `${guide}\nComo el ${info.name} no separa las palabras con espacios, en word_order escribí sentence con los bloques (cada palabra con su partícula) separados por un espacio; en las demás respuestas, escribí normalmente, sin espacios.`
    : guide
}

const immersionGuide = (language: LanguageId): string =>
  `Que el alumno sienta que usa el ${languageInfo(language).name} de verdad: situaciones que le pueden pasar (el trabajo, un viaje, un médico, un alquiler, una entrevista, una charla con un amigo), con nombres de personas y lugares concretos y un hilo que se entienda. Nada de oraciones sueltas de manual.`

function subtopicContext({ topic, subtopic }: PoolRequest): string {
  return `Tópico: ${topic.title} (${topic.targetTitle}), nivel ${topic.level}.
Subtema: ${subtopic.title}. Objetivo: ${subtopic.goal}
Puntos clave:
${subtopic.keyPoints.map((p) => `- ${p}`).join('\n')}`
}

export function buildPoolPrompt(request: PoolRequest, counts: Partial<Record<ExerciseType, number>> = request.counts): string {
  const { topic, subtopic, kind, avoid } = request
  const requested = Object.entries(counts)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join('\n')
  const examples = subtopic.examples.map((e) => `- ${e.target} (${e.es})`).join('\n')
  const mistakes = subtopic.commonMistakes.map((m) => `- "${m.wrong}" → "${m.right}": ${m.why}`).join('\n')

  return `${subtopicContext(request)}
Ejemplos:
${examples}
${mistakes ? `Errores comunes:\n${mistakes}\n` : ''}
${KIND_GUIDE[kind]}
${DIFFICULTY_GUIDE[request.difficulty ?? 'normal']}

Generá exactamente estos ejercicios, en este orden:
${requested}

${formatGuide(topic.language, Object.keys(counts) as ExerciseType[])}

${immersionGuide(topic.language)}
Usá vocabulario acorde al nivel ${topic.level}. El alumno tiene que necesitar lo que estudió del subtema para resolverlos: que no se puedan contestar de memoria ni adivinando.${
    avoid.length > 0
      ? `\nNo repitas estas oraciones, situaciones o consignas que el alumno ya practicó:\n${avoid.map((a) => `- ${a}`).join('\n')}`
      : ''
  }

${selfCheck(topic.language)}`
}

export function buildPoolReviewPrompt(request: PoolRequest, exercises: GeneratedExercise[]): string {
  const { topic } = request
  return `${subtopicContext(request)}

Otro docente generó estos ejercicios de práctica. Revisalos uno por uno.
${qualityChecklist(topic.language)}
${reviewChecks()}

Si un ejercicio tiene un error, corregilo; si no tiene arreglo, reemplazalo por otro del mismo tipo.
${CORRECTIONS_GUIDE}

${formatGuide(topic.language, [...new Set(exercises.map((e) => e.type))])}

Ejercicios a revisar:
${numbered(exercises)}`
}

const isLong = (type: ExerciseType): boolean => (LONG_TYPES as readonly string[]).includes(type)

function split(counts: Partial<Record<ExerciseType, number>>): Partial<Record<ExerciseType, number>>[] {
  const entries = Object.entries(counts) as [ExerciseType, number][]
  const groups = [entries.filter(([type]) => !isLong(type)), entries.filter(([type]) => isLong(type))]
  return groups.filter((group) => group.length > 0).map((group) => Object.fromEntries(group))
}

// Una tanda: se genera, se revisa y se devuelven los ejercicios ya corregidos.
async function generateGroup(request: PoolRequest, counts: Partial<Record<ExerciseType, number>>, ask: Ask): Promise<GeneratedExercise[]> {
  const started = Date.now()
  const raw = await ask({
    label: 'práctica',
    systemPrompt: systemPrompt(request.topic),
    prompt: buildPoolPrompt(request, counts),
    schema: poolSchema(typesOf(counts)),
    timeoutMs: GENERATION_TIMEOUT_MS,
    ticket: request.ticket
  })
  const exercises = valid(raw.exercises, 'práctica')
  const generated = Date.now()
  const review = await ask({
    label: 'práctica · revisión',
    systemPrompt: reviewSystemPrompt(request.topic.language),
    prompt: buildPoolReviewPrompt(request, exercises),
    schema: reviewSchema(typesOf(counts)),
    effort: REVIEW_EFFORT,
    timeoutMs: GENERATION_TIMEOUT_MS,
    ticket: request.ticket
  })
  const tipos = Object.keys(counts).join(', ')
  console.info(
    `[practice] ${request.subtopic.id} (${tipos}): generación ${Math.round((generated - started) / 1000)} s, revisión ${Math.round((Date.now() - generated) / 1000)} s`
  )
  if (review.issues.length > 0) {
    console.info(`[practice] La revisión encontró ${review.issues.length} problema(s):\n- ${review.issues.join('\n- ')}`)
  }
  return applyCorrections(exercises, valid(review.corrections, 'correcciones'), (a, b) => a.type === b.type)
}

// Una tanda lista para usar: generada, revisada y controlada. Si falla, se reintenta solo esa tanda,
// así un ejercicio corto mal armado no obliga a regenerar también los largos.
async function generateValidGroup(request: PoolRequest, counts: Partial<Record<ExerciseType, number>>, ask: Ask): Promise<StoredExercise[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const reviewed = await generateGroup(request, counts, ask)
      // Un ejercicio que no pasa los controles automáticos se descarta en lugar de romper toda la práctica.
      const prepared = reviewed.flatMap((e) => {
        try {
          return [prepareExercise(e)]
        } catch (err) {
          console.info(`[practice] Se descartó un ejercicio ${e.type}: ${(err as Error).message}`)
          return []
        }
      })
      const missing = (Object.keys(counts) as ExerciseType[]).filter((type) => !prepared.some((e) => e.type === type))
      if (missing.length > 0) throw new Error(`Claude no generó suficientes ejercicios válidos (faltan: ${missing.join(', ')}).`)
      return prepared
    } catch (err) {
      lastError = err
      if (!shouldRetry(err)) break
    }
  }
  throw lastError
}

export async function generatePracticePool(request: PoolRequest, ask: Ask = askClaude): Promise<StoredExercise[]> {
  const groups = await Promise.all(
    split(request.counts).map((counts) =>
      generateValidGroup(request, counts, ask).then((group) => {
        request.onGroup?.(group)
        return group
      })
    )
  )
  const prepared = groups.flat()
  // Con el pedido completo tiene que alcanzar para la práctica y alguna alternativa; si solo se pidió una parte, lo que se pidió.
  const requested = Object.values(request.counts).reduce((sum, n) => sum + (n ?? 0), 0)
  if (prepared.length < Math.min(requested, (request.size ?? SESSION_SIZE) + 1)) {
    throw new Error('Claude no generó suficientes ejercicios válidos para armar la práctica.')
  }
  return prepared
}

// Esfuerzo de lo que se genera en el momento: una sola pasada con autocontrol (decisión D3 del plan 3.0).
const ONE_PASS_EFFORT = 'medium'

// Ejercicios en una sola pasada (sin revisión aparte), con los controles automáticos de cada tipo.
async function generateOnce(request: PoolRequest, counts: Partial<Record<ExerciseType, number>>, ask: Ask, label: string): Promise<StoredExercise[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await ask({
        label,
        systemPrompt: systemPrompt(request.topic),
        prompt: buildPoolPrompt(request, counts),
        schema: poolSchema(typesOf(counts)),
        effort: ONE_PASS_EFFORT,
        timeoutMs: GENERATION_TIMEOUT_MS,
        ticket: request.ticket
      })
      const exercises = valid(raw.exercises, label)
      const prepared = exercises.flatMap((e) => {
        try {
          return [prepareExercise(e)]
        } catch (err) {
          console.info(`[practice] Se descartó un ejercicio ${e.type}: ${(err as Error).message}`)
          return []
        }
      })
      const missing = (Object.keys(counts) as ExerciseType[]).filter((type) => !prepared.some((e) => e.type === type))
      if (missing.length > 0) throw new Error(`Claude no generó ejercicios válidos de: ${missing.join(', ')}.`)
      return prepared
    } catch (err) {
      lastError = err
      if (!shouldRetry(err)) break
    }
  }
  throw lastError
}

// Un ejercicio largo en su propio pedido: así se piden en paralelo y aparece cada uno apenas está.
export async function generateLongOnce(request: PoolRequest, type: ExerciseType, ask: Ask = askClaude): Promise<StoredExercise> {
  const [exercise] = await generateOnce(request, { [type]: 1 }, ask, `práctica · ${type}`)
  return exercise
}

// Cortos que el banco no tenía, en una sola pasada.
export function generateShortOnce(
  request: PoolRequest,
  counts: Partial<Record<ExerciseType, number>>,
  ask: Ask = askClaude
): Promise<StoredExercise[]> {
  return generateOnce(request, counts, ask, 'práctica · cortos')
}

// Para el banco: se genera y se revisa (dos pasadas), porque cada ejercicio se va a usar muchas veces.
export async function generateBankSet(
  request: PoolRequest,
  counts: Partial<Record<ExerciseType, number>>,
  ask: Ask = askClaude
): Promise<StoredExercise[]> {
  return generateValidGroup(request, counts, ask)
}
