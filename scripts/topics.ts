// Escribe con Claude los tópicos nuevos del plan del temario (docs/temarios/<idioma>.json): un docente
// genera el tópico completo con su resumen y un revisor lo corrige. Uso:
// npm run content:topics -- <idioma> [nivel] [id del tópico]
// Guarda cada tópico apenas está y renumera el nivel, así se puede cortar y retomar.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { REVIEW_EFFORT, reviewSystemPrompt, roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { topicDir } from '../src/main/content/bank'
import { loadCurriculum } from '../src/main/content/curriculum'
import { CEFR_LEVELS, SKILLS, topicSchema, type CefrLevel, type Topic } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

const [language, onlyLevel, onlyTopic] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:topics -- <${LANGUAGE_IDS.join('|')}> [nivel] [id del tópico]`)
  process.exit(1)
}
const lang = language as LanguageId
const ROOT = resolve(import.meta.dirname, '..', '..')
const CONTENT = join(ROOT, 'content')
const info = languageInfo(lang)
const PARALLEL = 3

interface PlannedTopic {
  id: string
  title: string
  targetTitle: string
  description: string
  subtopics: string[]
  prerequisites: string[]
}
const plan = JSON.parse(readFileSync(join(ROOT, 'docs', 'temarios', `${lang}.json`), 'utf8')) as {
  levels: { level: CefrLevel; topics: PlannedTopic[] }[]
}

const text = z.string().trim().min(1)
const slug = z.string().regex(/^[a-z0-9-]+$/)
const pair = z.object({ target: text, es: text })
const generatedSchema = z.object({
  objectives: z.array(text).min(3).max(6),
  subtopics: z
    .array(
      z.object({
        id: slug,
        title: text,
        goal: text,
        focus: z.array(z.enum(SKILLS)).min(1),
        keyPoints: z.array(text).min(3).max(6),
        examples: z.array(pair).min(6).max(10),
        commonMistakes: z
          .array(z.object({ wrong: text, right: text, why: text }))
          .min(2)
          .max(4),
        chunks: z
          .array(z.object({ target: text, es: text, example: text, exampleEs: text }))
          .min(3)
          .max(6)
      })
    )
    .length(5),
  summary: z.string().min(800)
})
type Generated = z.infer<typeof generatedSchema>

// Un resumen de un tópico que ya existe, como modelo del formato.
function styleSample(): string {
  const first = loadCurriculum(CONTENT, lang, { validate: false })[0]
  const dir = first ? topicDir(CONTENT, lang, first) : null
  const file = dir ? join(dir, 'resumen.md') : null
  return file && existsSync(file) ? readFileSync(file, 'utf8').slice(0, 1500) : ''
}

function generationPrompt(level: CefrLevel, topic: PlannedTopic, before: string[]): string {
  return `Escribí un tópico del curso de ${info.promptName} para hispanohablantes (${spanish()}), nivel ${level}. Variante: ${info.variant}
Cada tópico es una semana: un subtema por día, de lunes a viernes. El alumno practica con ejercicios que se generan a partir de esto, así que todo tiene que estar bien y ser del nivel.

Tópico: ${topic.title} (${topic.targetTitle}). ${topic.description}
Subtemas (en este orden): ${topic.subtopics.map((s, i) => `${i + 1}. ${s}`).join('; ')}
Lo que el alumno ya estudió antes: ${before.join('; ') || '(es de lo primero del curso)'}

Campos, con estos nombres exactos: { objectives, subtopics: [{ id, title, goal, focus, keyPoints, examples: [{ target, es }], commonMistakes: [{ wrong, right, why }], chunks: [{ target, es, example, exampleEs }] }], summary }
- objectives: de 3 a 6 objetivos de la semana, en ${spanish()}.
- id: slug corto en minúsculas con guiones; title y goal en ${spanish()} (goal: qué va a poder hacer el alumno ese día).
- focus: las habilidades del día, en este patrón: día 1 ["grammar"], día 2 ["grammar"], día 3 ["grammar","reading"], día 4 ["grammar"], día 5 ["reading","writing"]. En tópicos de vocabulario o de géneros textuales, cambiá "grammar" por "reading" donde tenga más sentido.
- keyPoints: de 3 a 6 reglas o claves del día, en ${spanish()}, concretas, con el contraste con el español cuando ayuda.
- examples: 8 oraciones naturales en ${info.name} con su traducción al ${spanish()}, de uso real y del nivel.
- commonMistakes: 3 errores típicos de hispanohablantes en ese subtema (wrong y right en ${info.name}, why en ${spanish()}).
- chunks: de 4 a 6 frases hechas del subtema (colocaciones o expresiones fijas) con su equivalente en ${spanish()}, una oración de ejemplo que contenga la frase escrita exactamente igual y su traducción.
- summary: el resumen de la semana en Markdown, en ${spanish()} con los ejemplos en ${info.name}: un título (#), una introducción corta, una sección «## Día N — título» por subtema con la regla, tablas cuando ayudan y ejemplos en cursiva con su traducción, y al final «## En pocas palabras». Este es el estilo de un resumen que ya existe:
${styleSample()}

${selfCheck(lang)}`
}

function reviewPrompt(level: CefrLevel, topic: PlannedTopic, generated: Generated): string {
  return `Otro docente escribió este tópico del curso de ${info.promptName} para hispanohablantes, nivel ${level} (${topic.title}). Revisalo con ojo de experto en el idioma y devolvelo corregido entero, con los mismos campos.
Controlá: que las reglas sean correctas y completas para el nivel ${level}; que los ejemplos sean naturales, del nivel y estén bien traducidos; que los errores típicos sean reales en hispanohablantes; que cada chunk aparezca escrito exactamente igual en su example; que la variante sea coherente (${info.variant}); tildes y ortografía en los dos idiomas; que el resumen explique bien y coincida con los subtemas.
Si algo está bien, dejalo como está.

${JSON.stringify(generated)}`
}

async function writeTopic(level: CefrLevel, topic: PlannedTopic, before: string[]): Promise<void> {
  const started = Date.now()
  const generated = await askClaude({
    label: 'tópico',
    effort: 'medium',
    systemPrompt: roleSystemPrompt(lang, 'docente', 'Escribís material de curso exacto, claro y natural.'),
    prompt: generationPrompt(level, topic, before),
    schema: generatedSchema,
    timeoutMs: 600_000,
    ticket: { priority: 'now' }
  })
  const reviewed = await askClaude({
    label: 'tópico · revisión',
    effort: REVIEW_EFFORT,
    systemPrompt: reviewSystemPrompt(lang),
    prompt: reviewPrompt(level, topic, generated),
    schema: generatedSchema,
    timeoutMs: 600_000,
    ticket: { priority: 'now' }
  })
  // Claude a veces titula las secciones a su manera («### Dia 1», «## Day 1»): se llevan al formato del temario.
  reviewed.summary = reviewed.summary.replace(/^#{2,4}\s*(?:d[ií]a|day|tag|день)\s*(\d)\b/gim, '## Día $1')
  for (let day = 1; day <= 5; day++) {
    if (!new RegExp(`^## Día ${day}\\b`, 'm').test(reviewed.summary)) throw new Error(`al resumen le falta la sección «## Día ${day}»`)
  }
  const present = new Set(loadCurriculum(CONTENT, lang, { validate: false }).map((t) => t.id))
  const data: Topic = topicSchema.parse({
    id: topic.id,
    level,
    // Se renumera después con el resto del nivel.
    order: 99,
    title: topic.title,
    targetTitle: topic.targetTitle,
    description: topic.description,
    objectives: reviewed.objectives,
    prerequisites: topic.prerequisites.filter((p) => present.has(p)),
    reviewed: false,
    subtopics: reviewed.subtopics.map((s, i) => ({
      ...s,
      day: i + 1,
      chunks: s.chunks.filter((c) => c.example.toLowerCase().includes(c.target.toLowerCase()))
    }))
  })
  const dir = join(CONTENT, lang, level, topic.id.replace(new RegExp(`^${lang}-${level.toLowerCase()}-`), ''))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'topic.json'), `${JSON.stringify(data, null, 2)}\n`)
  writeFileSync(join(dir, 'resumen.md'), `${reviewed.summary.trim()}\n`)
  console.log(`${topic.id}: escrito en ${Math.round((Date.now() - started) / 1000)} s`)
}

// El orden de cada nivel según el plan, contando solo los tópicos que ya están escritos.
function renumber(level: CefrLevel): void {
  const planned = plan.levels.find((l) => l.level === level)?.topics.map((t) => t.id) ?? []
  const topics = loadCurriculum(CONTENT, lang, { validate: false }).filter((t) => t.level === level)
  const rank = (id: string): number => (planned.includes(id) ? planned.indexOf(id) : planned.length)
  ;[...topics]
    .sort((a, b) => rank(a.id) - rank(b.id) || a.order - b.order)
    .forEach((topic, i) => {
      const dir = topicDir(CONTENT, lang, topic)
      if (!dir) return
      const file = join(dir, 'topic.json')
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Topic
      if (raw.order === i + 1) return
      raw.order = i + 1
      writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
    })
}

const existing = new Set(loadCurriculum(CONTENT, lang, { validate: false }).map((t) => t.id))
const work = plan.levels
  .filter((l) => !onlyLevel || l.level === onlyLevel)
  .flatMap((l) => l.topics.map((topic) => ({ level: l.level, topic, before: [] as string[] })))
  .filter(({ topic }) => !existing.has(topic.id) && (!onlyTopic || topic.id === onlyTopic))

// Lo estudiado antes de cada tópico (títulos), para que no se repita y retome lo anterior.
const order = plan.levels.flatMap((l) => l.topics)
for (const item of work) item.before = order.slice(0, order.indexOf(item.topic)).map((t) => t.title)

console.log(`Tópicos nuevos de ${info.name}: ${work.length}`)
const queue = [...work]
const failures: string[] = []
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await writeTopic(item.level, item.topic, item.before)
        renumber(item.level)
      } catch (err) {
        failures.push(`${item.topic.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
)
for (const level of CEFR_LEVELS) renumber(level)
shutdownClaude()
if (failures.length > 0) {
  console.error(`Fallaron ${failures.length} tópicos:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
}
