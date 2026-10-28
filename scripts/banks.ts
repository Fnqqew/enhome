// Escribe los bancos de ejercicios del temario con Claude (generados y revisados): npm run content:banks -- <idioma> [nivel] [tópico]
// Completa solo los subtemas que tienen menos de lo que pide el banco y guarda después de cada uno,
// así se puede cortar y retomar. Usa la suscripción de Claude: en un temario entero tarda horas.

import type { Difficulty } from '../src/shared/difficulty'
import { join, resolve } from 'node:path'
import { bankWants, splitBankCounts, type BankType } from '../src/shared/bank'
import { mainText } from '../src/shared/exercise-types'
import type { GeneratedExercise, StoredExercise } from '../src/shared/exercises'
import { LANGUAGE_IDS, type LanguageId } from '../src/shared/languages'
import { shutdownClaude } from '../src/main/claude/bridge'
import { bankPath, readBank, writeBank } from '../src/main/content/bank'
import { loadCurriculum } from '../src/main/content/curriculum'
import { generateBankSet } from '../src/main/practice/generation'
import type { CurriculumTopic, Subtopic } from '../src/shared/curriculum'

// Uso: npm run content:banks -- <idioma> [nivel] [tópico] [--guiado | --exigente]
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'))
const [language, level, onlyTopic] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const difficulty: Difficulty = flags.includes('--guiado') ? 'guided' : flags.includes('--exigente') ? 'harder' : 'normal'
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:banks -- <${LANGUAGE_IDS.join('|')}> [nivel] [id del tópico]`)
  process.exit(1)
}
const CONTENT = resolve(import.meta.dirname, '..', '..', 'content')
const PARALLEL = 3

// Lo que le falta a un subtema para llegar a lo que pide el banco.
function missing(topic: CurriculumTopic, subtopic: Subtopic, have: GeneratedExercise[]): Partial<Record<BankType, number>> {
  return Object.fromEntries(
    (Object.entries(bankWants(subtopic, topic.level)) as [BankType, number][])
      .map(([t, want]) => [t, want - have.filter((e) => e.type === t).length] as const)
      .filter(([, n]) => n > 0)
  ) as Partial<Record<BankType, number>>
}

async function fillTopic(topic: CurriculumTopic): Promise<void> {
  const path = bankPath(CONTENT, language as LanguageId, topic, difficulty)!
  const bank = Object.fromEntries(readBank(path, topic).subtopics) as Record<string, GeneratedExercise[]>
  for (const subtopic of topic.subtopics) {
    const have = bank[subtopic.id] ?? []
    const counts = missing(topic, subtopic, have)
    if (Object.keys(counts).length === 0) continue
    const started = Date.now()
    const parts = await Promise.all(
      splitBankCounts(counts).map((part) =>
        generateBankSet(
          {
            topic,
            subtopic,
            kind: 'lesson',
            counts: part,
            avoid: have.map((e) => mainText(e as StoredExercise)),
            difficulty,
            ticket: { priority: 'now' }
          },
          part
        )
      )
    )
    // Se guarda lo generado tal cual lo devuelve Claude (sin mezclar): la app mezcla al usarlo.
    bank[subtopic.id] = [...have, ...(parts.flat() as GeneratedExercise[])]
    writeBank(path, bank)
    console.log(`${topic.id}/${subtopic.id}: +${parts.flat().length} en ${Math.round((Date.now() - started) / 1000)} s`)
  }
}

const topics = loadCurriculum(CONTENT, language as LanguageId).filter((t) => (!level || t.level === level) && (!onlyTopic || t.id === onlyTopic))
console.log(`Bancos de ${language}: ${topics.length} tópicos (${join('content', language)})`)
const queue = [...topics]
const failures: string[] = []
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let topic = queue.shift(); topic; topic = queue.shift()) {
      try {
        await fillTopic(topic)
      } catch (err) {
        failures.push(`${topic.id}: ${err instanceof Error ? err.message : String(err)}`)
        console.error(`${topic.id}: falló`, err)
      }
    }
  })
)
shutdownClaude()
if (failures.length > 0) {
  console.error(`Fallaron ${failures.length} tópicos:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
}
