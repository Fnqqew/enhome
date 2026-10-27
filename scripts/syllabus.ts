// Arma con Claude el plan del temario completo de un idioma (62 tópicos de A1 a C2): conserva los
// tópicos que ya existen y propone los que faltan, en orden. Uso: npm run content:syllabus -- <idioma>
// El plan queda en docs/temarios/<idioma>.json para revisarlo; después npm run content:topics escribe
// cada tópico nuevo.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { roleSystemPrompt, spanish } from '../src/main/claude/quality'
import { loadCurriculum } from '../src/main/content/curriculum'
import { CEFR_LEVELS, type CefrLevel } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

// Cuántos tópicos tiene cada nivel (decisión D2 del plan 3.0).
export const TOPICS_PER_LEVEL: Record<CefrLevel, number> = { A1: 10, A2: 10, B1: 12, B2: 12, C1: 10, C2: 8 }

const [language] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:syllabus -- <${LANGUAGE_IDS.join('|')}>`)
  process.exit(1)
}
const lang = language as LanguageId
const ROOT = resolve(import.meta.dirname, '..', '..')
const info = languageInfo(lang)
// Un idioma nuevo todavía no tiene tópicos: el plan se arma entero.
const existing = loadCurriculum(join(ROOT, 'content'), lang, { validate: false })

const text = z.string().trim().min(1)
const slug = z.string().regex(/^[a-z0-9-]+$/)
const planSchema = z.object({
  levels: z.array(
    z.object({
      level: z.enum(CEFR_LEVELS),
      topics: z.array(
        z.object({
          id: slug,
          title: text,
          targetTitle: text,
          description: text,
          subtopics: z.array(text).length(5),
          prerequisites: z.array(slug)
        })
      )
    })
  )
})

const current = CEFR_LEVELS.map((level) => {
  const topics = existing.filter((t) => t.level === level)
  return `${level} (hoy ${topics.length}, tiene que tener ${TOPICS_PER_LEVEL[level]}):\n${
    topics.map((t) => `- ${t.id}: ${t.title} — ${t.subtopics.map((s) => s.title).join('; ')}`).join('\n') || '- (ninguno)'
  }`
}).join('\n\n')

const prompt = `Armá el temario completo de un curso de ${info.promptName} para hispanohablantes, de A1 a C2, alineado con el MCER (y con el plan curricular del idioma cuando lo hay). Variante: ${info.variant}
Cada tópico es una semana: cinco subtemas, uno por día, de lunes a viernes.

Los tópicos que ya existen (conservá todos, con el mismo id, en su nivel):
${current}

Completá cada nivel hasta la cantidad indicada con tópicos nuevos que cubran lo que falta para dominar ese nivel: gramática, funciones comunicativas (pedir, opinar, narrar, argumentar), vocabulario por temas y, en C1 y C2, registro, matices, conectores, géneros textuales y expresiones idiomáticas. Nada repetido entre tópicos.
Ordená los tópicos de cada nivel en el orden en que conviene estudiarlos (el primero de A1 sigue siendo el primero). Los ids nuevos: ${lang}-<nivel en minúsculas>-<slug corto>.
Campos, con estos nombres exactos: { levels: [{ level, topics: [{ id, title, targetTitle, description, subtopics, prerequisites }] }] }
- title: en ${spanish()}; targetTitle: en ${info.name}.
- description: dos oraciones en ${spanish()}: qué se aprende y para qué sirve.
- subtopics: los cinco títulos de los subtemas, en ${spanish()}.
- prerequisites: ids de tópicos anteriores que conviene saber (puede estar vacío).
Los tópicos que ya existen van con sus datos actuales (podés dejar description y subtopics como están).`

const plan = await askClaude({
  label: 'temario',
  effort: 'high',
  systemPrompt: roleSystemPrompt(lang, 'coordinador académico', 'Diseñás programas de idiomas completos, progresivos y sin huecos.'),
  prompt,
  schema: planSchema,
  timeoutMs: 600_000,
  ticket: { priority: 'now' }
})
shutdownClaude()

// Controles: cantidades por nivel, que estén todos los tópicos de hoy y que no haya ids repetidos.
const problems: string[] = []
const ids = plan.levels.flatMap((l) => l.topics.map((t) => t.id))
if (new Set(ids).size !== ids.length) problems.push('hay ids repetidos')
for (const level of CEFR_LEVELS) {
  const count = plan.levels.find((l) => l.level === level)?.topics.length ?? 0
  if (count !== TOPICS_PER_LEVEL[level]) problems.push(`${level} tiene ${count} tópicos (tienen que ser ${TOPICS_PER_LEVEL[level]})`)
}
for (const topic of existing) if (!ids.includes(topic.id)) problems.push(`falta el tópico que ya existe ${topic.id}`)

const dir = join(ROOT, 'docs', 'temarios')
mkdirSync(dir, { recursive: true })
const file = join(dir, `${lang}.json`)
writeFileSync(file, `${JSON.stringify({ language: lang, existing: existing.map((t) => t.id), ...plan }, null, 2)}\n`)
console.log(`Plan de ${info.name}: ${ids.length} tópicos (${ids.length - existing.length} nuevos) en ${file}`)
if (problems.length > 0) {
  console.error(`Revisar:\n- ${problems.join('\n- ')}`)
  process.exitCode = 1
}
