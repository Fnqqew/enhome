// Generación con Claude de los ejercicios de una práctica: un docente los genera y un revisor los corrige.
// Se piden en dos tandas, los cortos y los largos, para que ninguna respuesta quede cortada.

import { z } from 'zod'
import type { CurriculumTopic, Subtopic } from '../../shared/curriculum'
import { generatedExerciseSchema, LONG_TYPES, type ExerciseType, type GeneratedExercise, type StoredExercise } from '../../shared/exercises'
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
import { prepareExercise } from './exercises'

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

const poolSchema = z.object({ exercises: z.array(generatedExerciseSchema).min(1) })
const reviewSchema = z.object({
  issues: z.array(z.string()),
  corrections: z.array(z.object({ index: z.number().int().min(0), replacement: generatedExerciseSchema }))
})

const KIND_GUIDE: Record<UnitKind, string> = {
  lesson: 'Es la práctica del día en que el alumno trabaja este subtema. Empezá por lo más simple y subí la dificultad de a poco.',
  focus:
    'Es una práctica de refuerzo: el alumno reprobó el examen de este tópico. Insistí en los puntos clave y en los errores comunes, con ejercicios guiados.',
  review: 'Es un repaso: ejercicios variados que mezclen los puntos clave del subtema.'
}

// Cómo es cada formato. El idioma cambia en qué lengua van las oraciones; la extensión depende del nivel.
export function formatGuide(language: LanguageId): string {
  const l = languageInfo(language).name
  return `Formatos (el campo type indica cuál es):
- multiple_choice: prompt en ${l} (marcá el hueco con ___ si corresponde); 4 opciones con una sola correcta; correctIndex es su posición (0 a 3).
- fill_blank: sentence en ${l} con exactamente un ___; hint con una pista breve entre paréntesis (por ejemplo, el infinitivo del verbo) o vacío; answers con todas las variantes válidas (con y sin contracción o apóstrofo cuando el idioma las tenga).
- word_order: sentence es una oración correcta en ${l} de 5 a 12 palabras (el alumno la arma con las palabras mezcladas); alternatives con otros órdenes válidos o vacío; translation es su traducción al español.
- error_correction: sentence en ${l} con un solo error relacionado con el subtema; answers con la oración corregida y sus variantes válidas.
- translation: spanish es una oración completa en ${spanish()} para traducir al ${l}; answers con 1 a 3 traducciones correctas.
- translation_set: situation describe en español una escena cotidiana; sentences son 3 o 4 oraciones completas de esa misma escena, cada una con spanish, answers (traducciones válidas al ${l}) y explanation. Las oraciones tienen que encadenarse como un relato, no ser frases sueltas.
- dialogue: situation describe en español dónde pasa la charla y con quién; script es la conversación en orden, alternando partes: las del otro con role "other", speaker (el nombre o rol de quien habla) y text en ${l}; las del alumno con role "you", cue (en español, qué tiene que decir, concreto) y sample (una respuesta modelo natural en ${l}). Tiene que haber 2 o 3 turnos del alumno y la charla tiene que cerrar bien.
- roleplay: situation plantea en español una situación real (un trámite, una compra, un reclamo, una presentación); goal es lo que el alumno tiene que conseguir; steps son 3 o 4 pasos en orden, cada uno con cue (qué tiene que decir o preguntar, en español) y sample (cómo se diría en ${l}). Los pasos tienen que avanzar la situación, no repetirse.
- reading: text en ${l} con 2 o 3 preguntas de opción múltiple (4 opciones, una correcta). Extensión: A1 y A2, de 90 a 140 palabras; B1, de 140 a 200; B2, de 180 a 250; C1, de 220 a 300.
- writing: task en español con una consigna concreta y realista; minWords y maxWords acordes al nivel (A1: entre 35 y 70; A2: entre 60 y 110; B1: entre 100 y 160; B2: entre 150 y 220; C1: entre 200 y 280); guidance con 2 a 4 puntos de qué incluir; sampleAnswer con una respuesta modelo en ${l}.
Todas las instruction van en español y son breves. Toda explanation va en español, en una o dos oraciones, y explica la regla.`
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

${formatGuide(topic.language)}

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
- fill_blank: el hueco admite solo las respuestas de answers, y answers incluye todas las variantes válidas (con y sin contracción).
- word_order: la oración es correcta y alternatives incluye los otros órdenes válidos.
- error_correction: la oración tiene exactamente un error y answers lo corrige.
- translation: answers son traducciones correctas y naturales.
- translation_set: las oraciones cuentan una misma escena en orden y cada answers es una traducción natural.
- dialogue: la conversación tiene sentido de principio a fin, cada cue pide algo concreto y cada sample responde de verdad a lo anterior.
- roleplay: los pasos avanzan hacia el objetivo, no se repiten y cada sample es lo que diría un hablante nativo en esa situación.
- reading: cada respuesta se deduce del texto y solo una opción es correcta.
- writing: la consigna es clara, la extensión es acorde al nivel y sampleAnswer no tiene errores.

Si un ejercicio tiene un error, corregilo; si no tiene arreglo, reemplazalo por otro del mismo tipo.
${CORRECTIONS_GUIDE}

${formatGuide(topic.language)}

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
  const { exercises } = await ask({
    label: 'práctica',
    systemPrompt: systemPrompt(request.topic),
    prompt: buildPoolPrompt(request, counts),
    schema: poolSchema,
    timeoutMs: GENERATION_TIMEOUT_MS,
    ticket: request.ticket
  })
  const generated = Date.now()
  const review = await ask({
    label: 'práctica · revisión',
    systemPrompt: reviewSystemPrompt(request.topic.language),
    prompt: buildPoolReviewPrompt(request, exercises),
    schema: reviewSchema,
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
  return applyCorrections(exercises, review.corrections, (a, b) => a.type === b.type)
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
