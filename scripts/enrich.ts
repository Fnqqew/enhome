// Enriquece con Claude los tópicos que ya existen: suma ejemplos (hasta 8 por subtema), errores típicos
// (hasta 3), el contraste con el español en los puntos clave y frases hechas (hasta 4), sin tocar lo que
// ya está. Uso: npm run content:enrich -- <idioma> [nivel] [id del tópico]

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { topicDir } from '../src/main/content/bank'
import { loadCurriculum } from '../src/main/content/curriculum'
import { topicSchema, type CurriculumTopic, type Topic } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

const EXAMPLES = 8
const MISTAKES = 3
const CHUNKS = 4
const PARALLEL = 3

const [language, onlyLevel, onlyTopic] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:enrich -- <${LANGUAGE_IDS.join('|')}> [nivel] [id del tópico]`)
  process.exit(1)
}
const lang = language as LanguageId
const info = languageInfo(lang)
const CONTENT = resolve(import.meta.dirname, '..', '..', 'content')

const text = z.string().trim().min(1)
const additionsSchema = z.object({
  subtopics: z.array(
    z.object({
      id: text,
      examples: z.array(z.object({ target: text, es: text })),
      commonMistakes: z.array(z.object({ wrong: text, right: text, why: text })),
      // Un punto clave con el contraste con el español, si los que hay no lo tienen (si no, vacío).
      contrast: z.string(),
      chunks: z.array(z.object({ target: text, es: text, example: text, exampleEs: text }))
    })
  )
})

const needs = (t: CurriculumTopic): boolean =>
  t.subtopics.some((s) => s.examples.length < EXAMPLES || s.commonMistakes.length < MISTAKES || (s.chunks?.length ?? 0) < CHUNKS)

function prompt(topic: CurriculumTopic): string {
  const subtopics = topic.subtopics.map((s) => ({
    id: s.id,
    title: s.title,
    goal: s.goal,
    keyPoints: s.keyPoints,
    examples: s.examples.map((e) => e.target),
    commonMistakes: s.commonMistakes.map((m) => m.wrong),
    chunks: (s.chunks ?? []).map((c) => c.target),
    faltan: {
      examples: Math.max(0, EXAMPLES - s.examples.length),
      commonMistakes: Math.max(0, MISTAKES - s.commonMistakes.length),
      chunks: Math.max(0, CHUNKS - (s.chunks?.length ?? 0))
    }
  }))
  return `Enriquecé un tópico del curso de ${info.promptName} para hispanohablantes (${spanish()}), nivel ${topic.level}: ${topic.title} (${topic.targetTitle}). Variante: ${info.variant}
Para cada subtema, agregá exactamente lo que dice «faltan», sin repetir nada de lo que ya tiene:
${JSON.stringify(subtopics)}

Campos, con estos nombres exactos: { subtopics: [{ id, examples: [{ target, es }], commonMistakes: [{ wrong, right, why }], contrast, chunks: [{ target, es, example, exampleEs }] }] }
- examples: oraciones naturales en ${info.name}, de uso real y del nivel, con su traducción al ${spanish()}.
- commonMistakes: errores típicos de hispanohablantes en ese subtema (wrong y right en ${info.name}, why en ${spanish()}).
- contrast: si ningún punto clave compara con el español, uno nuevo que diga en qué se parece o se diferencia del español («En español decimos… pero en ${info.name}…»); si ya hay uno, vacío.
- chunks: frases hechas del subtema con su equivalente en ${spanish()} y una oración de ejemplo que contenga la frase escrita exactamente igual, con su traducción.
${selfCheck(lang)}`
}

async function enrich(topic: CurriculumTopic): Promise<void> {
  const started = Date.now()
  const { subtopics } = await askClaude({
    label: 'enriquecer tópico',
    effort: 'medium',
    systemPrompt: roleSystemPrompt(lang, 'docente', 'Escribís material de curso exacto, claro y natural.'),
    prompt: prompt(topic),
    schema: additionsSchema,
    timeoutMs: 300_000,
    ticket: { priority: 'now' }
  })
  const dir = topicDir(CONTENT, lang, topic)
  if (!dir) throw new Error('no encontré su carpeta')
  const file = join(dir, 'topic.json')
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Topic
  let added = 0
  for (const subtopic of raw.subtopics) {
    const more = subtopics.find((s) => s.id === subtopic.id)
    if (!more) continue
    const seen = (list: string[], value: string): boolean => list.some((v) => v.toLowerCase() === value.toLowerCase())
    const examples = more.examples.filter(
      (e) =>
        !seen(
          subtopic.examples.map((x) => x.target),
          e.target
        )
    )
    const mistakes = more.commonMistakes.filter(
      (m) =>
        !seen(
          subtopic.commonMistakes.map((x) => x.wrong),
          m.wrong
        )
    )
    const chunks = more.chunks.filter(
      (c) =>
        c.example.toLowerCase().includes(c.target.toLowerCase()) &&
        !seen(
          (subtopic.chunks ?? []).map((x) => x.target),
          c.target
        )
    )
    subtopic.examples = [...subtopic.examples, ...examples].slice(0, 10)
    subtopic.commonMistakes = [...subtopic.commonMistakes, ...mistakes].slice(0, 4)
    subtopic.chunks = [...(subtopic.chunks ?? []), ...chunks].slice(0, 8)
    if (more.contrast.trim()) subtopic.keyPoints = [...subtopic.keyPoints, more.contrast.trim()]
    added += examples.length + mistakes.length + chunks.length
  }
  topicSchema.parse(raw)
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
  console.log(`${topic.id}: +${added} en ${Math.round((Date.now() - started) / 1000)} s`)
}

const topics = loadCurriculum(CONTENT, lang).filter((t) => (!onlyLevel || t.level === onlyLevel) && (!onlyTopic || t.id === onlyTopic) && needs(t))
console.log(`Tópicos de ${info.name} para enriquecer: ${topics.length}`)
const queue = [...topics]
const failures: string[] = []
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let topic = queue.shift(); topic; topic = queue.shift()) {
      try {
        await enrich(topic)
      } catch (err) {
        failures.push(`${topic.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
)
shutdownClaude()
if (failures.length > 0) {
  console.error(`Fallaron ${failures.length} tópicos:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
}
