// Escribe con Claude las preguntas del examen inicial que faltan (content/<idioma>/placement.json),
// para los tópicos de A1 a C1 que todavía no tienen. Uso: npm run content:placement -- <idioma>
// Así el examen inicial puede ubicar hasta C1 sin esperar a Claude.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { loadCurriculum } from '../src/main/content/curriculum'
import { PLACEMENT_QUESTIONS_PER_TOPIC } from '../src/main/engine/rules'
import type { CurriculumTopic } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

const [language] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:placement -- <${LANGUAGE_IDS.join('|')}>`)
  process.exit(1)
}
const lang = language as LanguageId
const CONTENT = resolve(import.meta.dirname, '..', '..', 'content')
const FILE = join(CONTENT, lang, 'placement.json')
const PARALLEL = 3
// Hasta dónde ubica el examen inicial.
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const text = z.string().trim().min(1)
const question = z.object({
  subtopicId: text,
  instruction: text,
  prompt: text,
  options: z.array(text).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: text
})
type Question = z.infer<typeof question>
const schema = z.object({ questions: z.array(question.catch(null as unknown as Question)) })

function prompt(topic: CurriculumTopic): string {
  const name = languageInfo(lang).promptName
  return `Escribí preguntas para el examen inicial de un curso de ${name} para hispanohablantes: sirven para saber si el alumno ya domina este tópico y puede saltearlo.
Tópico: ${topic.title} (${topic.targetTitle}), nivel ${topic.level}. ${topic.description}
Subtemas:
${topic.subtopics.map((s) => `- ${s.id}: ${s.title}. ${s.goal}`).join('\n')}

Escribí una pregunta de opción múltiple por cada uno de los primeros cuatro subtemas.
Campos, con estos nombres exactos: { questions: [{ subtopicId, instruction, prompt, options, correctIndex, explanation }] }
- subtopicId: el id del subtema de la lista.
- instruction: la consigna en ${spanish()}, breve.
- prompt: una oración en ${name} con ___ donde va la respuesta (o una pregunta corta), que solo resuelve quien domina el subtema.
- options: 4 opciones cortas y distintas (no la oración entera), una sola correcta; los distractores, errores típicos de hispanohablantes.
- correctIndex: la posición de la correcta (0 a 3), variando entre preguntas.
- explanation: por qué es la correcta, en ${spanish()}, en una oración.
${selfCheck(lang)}`
}

// Un idioma nuevo todavía no tiene banco: se arranca vacío.
const bank = (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { topics: {} }) as { topics: Record<string, Question[]> }
const save = (): void => writeFileSync(FILE, `${JSON.stringify(bank, null, 2)}\n`)
const topics = loadCurriculum(CONTENT, lang).filter((t) => LEVELS.includes(t.level) && !bank.topics[t.id])
console.log(`Examen inicial de ${lang}: faltan ${topics.length} tópicos`)

const queue = [...topics]
const failures: string[] = []
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let topic = queue.shift(); topic; topic = queue.shift()) {
      try {
        const { questions } = await askClaude({
          label: 'examen inicial',
          effort: 'medium',
          systemPrompt: roleSystemPrompt(lang, 'evaluador', 'Escribís preguntas de ubicación precisas y sin ambigüedades.'),
          prompt: prompt(topic),
          schema,
          timeoutMs: 180_000,
          ticket: { priority: 'now' }
        })
        // Los mismos controles que hace la app al cargar el banco.
        const valid = questions.filter(
          (q): q is Question =>
            !!q &&
            topic.subtopics.some((s) => s.id === q.subtopicId) &&
            new Set(q.options.map((o) => o.toLowerCase())).size === 4 &&
            q.options.every((o) => o.length < q.prompt.length + 40)
        )
        if (new Set(valid.map((q) => q.subtopicId)).size < PLACEMENT_QUESTIONS_PER_TOPIC) throw new Error('pocas preguntas válidas')
        bank.topics[topic.id] = valid
        save()
        console.log(`${topic.id}: ${valid.length} preguntas`)
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
