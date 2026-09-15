// Resúmenes con Claude: un docente los escribe y un revisor los corrige antes de guardarlos.
// También responde preguntas sobre un fragmento de texto seleccionado.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import type { GeneratedSummaryType, SummaryContent } from '../../shared/summaries'
import { SUMMARY_TYPES } from '../../shared/summaries'
import { askClaude, type Ask } from '../claude/bridge'
import {
  applyCorrections,
  CORRECTIONS_GUIDE,
  numbered,
  QUALITY_CHECKLIST,
  REVIEW_EFFORT,
  REVIEW_SYSTEM_PROMPT,
  SELF_CHECK
} from '../claude/quality'

const TIMEOUT_MS = 240_000
const MAX_ATTEMPTS = 2
export const MIN_MARKDOWN_LENGTH = 80

const SYSTEM_PROMPT =
  'Sos un docente de inglés para hispanohablantes de Argentina. Escribís materiales de estudio claros, ordenados y sin errores. Respondé solo con el JSON pedido.'

const GUIDANCE: Record<GeneratedSummaryType, string> = {
  esquema: 'Un esquema jerárquico con viñetas cortas: lo esencial de cada subtema, sin párrafos largos. Entre 150 y 350 palabras.',
  tablas: 'Tablas comparativas con las formas, los usos y ejemplos de cada subtema, con una frase de introducción antes de cada tabla. Entre 200 y 450 palabras.',
  ejemplos:
    'Muchos ejemplos en contexto agrupados por subtema y por situación cotidiana (al menos 4 por subtema), cada uno con su traducción y, si hace falta, una nota breve. Entre 300 y 600 palabras.',
  errores:
    'Los errores más comunes de hispanohablantes en este tópico: para cada uno, la forma incorrecta, la correcta, por qué pasa (influencia del español) y un truco para evitarlo. Entre 250 y 500 palabras.',
  comparacion: 'Comparación con el español: qué funciona igual, qué cambia y qué no existe en español, con ejemplos lado a lado. Entre 250 y 500 palabras.',
  'paso-a-paso':
    'Cómo construir las oraciones paso a paso, como una receta: pasos numerados para afirmar, negar y preguntar según corresponda, con un ejemplo armado en cada paso. Entre 250 y 500 palabras.',
  historia:
    'Una mini historia en inglés de 150 a 250 palabras que use el tema de forma natural, seguida de su traducción y de notas que señalen dónde aparece cada punto del tópico.',
  dialogo: 'Un diálogo cotidiano en inglés entre dos personas, de 12 a 20 intervenciones, que use el tema, con la traducción de cada línea y notas breves sobre lo que se practica.',
  simple: 'La explicación más simple posible, para alguien que nunca estudió gramática: pocas palabras técnicas, ideas cortas y uno o dos ejemplos por idea. Entre 150 y 300 palabras.',
  preguntas: 'Entre 6 y 10 preguntas frecuentes que se hace un alumno sobre este tópico, cada una con una respuesta clara y un ejemplo.',
  trucos: 'Trucos para recordar: reglas mnemotécnicas, asociaciones y atajos para no equivocarse, cada uno con un ejemplo. Entre 200 y 400 palabras.',
  tarjetas:
    'Entre 10 y 14 tarjetas de repaso que cubran todos los subtemas: front es una pregunta o consigna corta (en español, o una oración en inglés para completar), back es la respuesta breve y example es un ejemplo en inglés con su traducción entre paréntesis.'
}

const WRITING_RULES = `Reglas:
- Explicaciones en español rioplatense; ejemplos en inglés con su traducción.
- Solo sobre este tópico y su nivel: no adelantes contenidos de tópicos posteriores.
- No inventes reglas: todo tiene que ser coherente con el resumen base.`

const MARKDOWN_RULES = `- Formato Markdown: títulos con ## y ###, listas, **negrita** para lo importante y tablas cuando sirvan. Sin HTML ni bloques de código. No repitas el título del tópico como título principal.`

const markdownSchema = z.object({ markdown: z.string().min(MIN_MARKDOWN_LENGTH) })
const markdownReviewSchema = z.object({ issues: z.array(z.string()), correctedMarkdown: z.string() })
const cardSchema = z.object({ front: z.string().trim().min(1), back: z.string().trim().min(1), example: z.string() })
const cardsSchema = z.object({ cards: z.array(cardSchema).min(8).max(16) })
const cardsReviewSchema = z.object({
  issues: z.array(z.string()),
  corrections: z.array(z.object({ index: z.number().int().min(0), replacement: cardSchema }))
})

function topicContext(topic: CurriculumTopic): string {
  const subtopics = [...topic.subtopics]
    .sort((a, b) => a.day - b.day)
    .map(
      (s) =>
        `### Día ${s.day}: ${s.title}\nObjetivo: ${s.goal}\nPuntos clave:\n${s.keyPoints.map((p) => `- ${p}`).join('\n')}\nErrores comunes:\n${
          s.commonMistakes.map((m) => `- "${m.wrong}" → "${m.right}": ${m.why}`).join('\n') || '- (ninguno)'
        }`
    )
    .join('\n\n')
  return `Tópico: ${topic.title} (${topic.titleEn}), nivel ${topic.level}.
${topic.description}

${subtopics}

Resumen base del tópico (revisado; usalo como referencia, no lo copies):
"""
${topic.summary}
"""`
}

export function buildSummaryPrompt(topic: CurriculumTopic, type: GeneratedSummaryType): string {
  return `${topicContext(topic)}

Escribí un resumen de tipo «${SUMMARY_TYPES[type].label}»: ${GUIDANCE[type]}

${WRITING_RULES}
${type === 'tarjetas' ? '' : MARKDOWN_RULES}

${SELF_CHECK}`
}

function reviewPrompt(topic: CurriculumTopic, type: GeneratedSummaryType, body: string, outputGuide: string): string {
  return `${topicContext(topic)}

Otro docente escribió este material de tipo «${SUMMARY_TYPES[type].label}» (${GUIDANCE[type]}). Revisalo con máximo rigor.
${QUALITY_CHECKLIST}
- Las reglas gramaticales son correctas y coinciden con el resumen base.
- Los ejemplos en inglés son correctos y naturales, y sus traducciones son fieles.
- No hay información inventada, contenido de otros niveles ni contradicciones.

${outputGuide}

Material a revisar:
${body}`
}

async function generateMarkdown(topic: CurriculumTopic, type: GeneratedSummaryType, ask: Ask): Promise<SummaryContent> {
  const { markdown } = await ask({ systemPrompt: SYSTEM_PROMPT, prompt: buildSummaryPrompt(topic, type), schema: markdownSchema, timeoutMs: TIMEOUT_MS })
  const review = await ask({
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    prompt: reviewPrompt(
      topic,
      type,
      `"""\n${markdown}\n"""`,
      `Si encontrás errores, devolvé en correctedMarkdown el material completo ya corregido, con el mismo formato. Si está todo bien, correctedMarkdown va vacío.
En issues anotá, en una frase cada uno, los problemas que encontraste (vacío si no hubo).`
    ),
    schema: markdownReviewSchema,
    effort: REVIEW_EFFORT,
    timeoutMs: TIMEOUT_MS
  })
  logIssues(topic, type, review.issues)

  const corrected = review.correctedMarkdown.trim()
  if (corrected && corrected.length < MIN_MARKDOWN_LENGTH) throw new Error('La revisión devolvió un resumen incompleto.')
  return { format: 'markdown', markdown: corrected || markdown }
}

async function generateCards(topic: CurriculumTopic, ask: Ask): Promise<SummaryContent> {
  const { cards } = await ask({ systemPrompt: SYSTEM_PROMPT, prompt: buildSummaryPrompt(topic, 'tarjetas'), schema: cardsSchema, timeoutMs: TIMEOUT_MS })
  const review = await ask({
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    prompt: reviewPrompt(topic, 'tarjetas', numbered(cards), CORRECTIONS_GUIDE),
    schema: cardsReviewSchema,
    effort: REVIEW_EFFORT,
    timeoutMs: TIMEOUT_MS
  })
  logIssues(topic, 'tarjetas', review.issues)
  return { format: 'cards', cards: applyCorrections(cards, review.corrections) }
}

function logIssues(topic: CurriculumTopic, type: GeneratedSummaryType, issues: string[]): void {
  if (issues.length > 0) console.info(`[summaries] ${topic.id}/${type}: la revisión encontró ${issues.length} problema(s):\n- ${issues.join('\n- ')}`)
}

export async function generateSummary(topic: CurriculumTopic, type: GeneratedSummaryType, ask: Ask = askClaude): Promise<SummaryContent> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return type === 'tarjetas' ? await generateCards(topic, ask) : await generateMarkdown(topic, type, ask)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

const answerSchema = z.object({ answer: z.string().min(1) })

// Respuesta en el momento a una duda sobre un fragmento (sin segunda revisión, para no hacer esperar).
export async function answerAboutText(
  { topic, fragment, question }: { topic: CurriculumTopic; fragment: string; question: string },
  ask: Ask = askClaude
): Promise<string> {
  const { answer } = await ask({
    systemPrompt: 'Sos un docente de inglés para hispanohablantes de Argentina. Respondés dudas de forma breve, clara y correcta. Respondé solo con el JSON pedido.',
    prompt: `${topicContext(topic)}

El alumno seleccionó este fragmento mientras estudiaba:
"""
${fragment}
"""
Su pregunta: ${question}

Respondé en español rioplatense, en Markdown y en no más de 200 palabras, con al menos un ejemplo en inglés con su traducción cuando ayude. Si la pregunta se va del tema, respondé lo esencial y volvé al tópico.

${SELF_CHECK}`,
    schema: answerSchema
  })
  return answer
}
