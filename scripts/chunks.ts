// Escribe con Claude las frases hechas de cada subtema en el temario: npm run content:chunks -- <idioma> [nivel] [tópico]
// Un pedido por tópico (los cinco subtemas juntos) y solo para los tópicos que todavía no las tienen.
// Guarda en topic.json después de cada tópico, así se puede cortar y retomar.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { topicDir } from '../src/main/content/bank'
import { loadCurriculum } from '../src/main/content/curriculum'
import type { Chunk, CurriculumTopic } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

const [language, level, onlyTopic] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:chunks -- <${LANGUAGE_IDS.join('|')}> [nivel] [id del tópico]`)
  process.exit(1)
}
const lang = language as LanguageId
const CONTENT = resolve(import.meta.dirname, '..', '..', 'content')
const PARALLEL = 3
const MIN_CHUNKS = 3

const text = z.string().trim().min(1)
const schema = z.object({
  subtopics: z.array(
    z.object({ id: text, chunks: z.array(z.object({ target: text, es: text, example: text, exampleEs: text }).catch(null as unknown as Chunk)) })
  )
})

function prompt(topic: CurriculumTopic): string {
  const name = languageInfo(lang).name
  const subtopics = topic.subtopics.map((s) => `- ${s.id}: ${s.title}. ${s.goal}`).join('\n')
  return `Tópico: ${topic.title} (${topic.targetTitle}), nivel ${topic.level}.
Subtemas:
${subtopics}

Para cada subtema, escribí entre 4 y 6 frases hechas del ${name} que un hablante nativo usa todo el tiempo y que tengan que ver con el subtema: colocaciones, expresiones fijas y fórmulas de la vida diaria (saludar, pedir, disculparse, opinar). Que se aprendan enteras, como un bloque, y que sirvan al nivel ${topic.level}. Nada de palabras sueltas ni de oraciones de manual.
Campos, con estos nombres exactos: { subtopics: [{ id, chunks: [{ target, es, example, exampleEs }] }] }
- target: la frase hecha en ${name}, de 2 a 6 palabras.
- es: su equivalente natural en ${spanish()} (lo que diría un hablante, no una traducción palabra por palabra).
- example: una oración natural en ${name} que contenga target escrito exactamente igual (mismas letras, sin conjugarlo distinto).
- exampleEs: la traducción de example al ${spanish()}.
Usá los mismos id de subtema de la lista. No repitas frases entre subtemas.

${selfCheck(lang)}`
}

async function fillTopic(topic: CurriculumTopic): Promise<void> {
  if (topic.subtopics.every((s) => (s.chunks?.length ?? 0) >= MIN_CHUNKS)) return
  const dir = topicDir(CONTENT, lang, topic)
  if (!dir) throw new Error('no encontré su carpeta')
  const started = Date.now()
  const result = await askClaude({
    label: 'frases hechas',
    systemPrompt: roleSystemPrompt(lang, 'docente', 'Elegís las expresiones más útiles y naturales del idioma.'),
    prompt: prompt(topic),
    schema,
    effort: 'medium',
    timeoutMs: 300_000,
    ticket: { priority: 'now' }
  })
  const file = join(dir, 'topic.json')
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { subtopics: { id: string; chunks?: Chunk[] }[] }
  let added = 0
  for (const subtopic of raw.subtopics) {
    const found = result.subtopics.find((s) => s.id === subtopic.id)
    // Solo las que aparecen tal cual en su ejemplo: si no, la tarjeta con hueco no se puede armar.
    const chunks = (found?.chunks ?? []).filter((c): c is Chunk => !!c && c.example.toLowerCase().includes(c.target.toLowerCase())).slice(0, 6)
    if (chunks.length < MIN_CHUNKS) continue
    subtopic.chunks = chunks
    added += chunks.length
  }
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
  console.log(`${topic.id}: +${added} frases en ${Math.round((Date.now() - started) / 1000)} s`)
}

const topics = loadCurriculum(CONTENT, lang).filter((t) => (!level || t.level === level) && (!onlyTopic || t.id === onlyTopic))
console.log(`Frases hechas de ${lang}: ${topics.length} tópicos`)
const queue = [...topics]
const failures: string[] = []
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let topic = queue.shift(); topic; topic = queue.shift()) {
      try {
        await fillTopic(topic)
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
