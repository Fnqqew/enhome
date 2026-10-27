// Escribe con Claude el vocabulario núcleo de un idioma (content/<idioma>/vocabulario.json): unas 3.000
// palabras de A1 a C2, en orden de frecuencia, de a tandas de 100 sin repetir. Uso:
// npm run content:vocab -- <idioma> [nivel]
// Guarda después de cada tanda, así se puede cortar y retomar.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { coreWordSchema, type CoreWord } from '../src/shared/core-vocab'
import { CEFR_LEVELS, type CefrLevel } from '../src/shared/curriculum'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'

// Cuántas palabras tiene cada nivel (unas 3.000 en total).
const PER_LEVEL: Record<CefrLevel, number> = { A1: 500, A2: 500, B1: 600, B2: 600, C1: 500, C2: 300 }
const BATCH = 100

const [language, onlyLevel] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:vocab -- <${LANGUAGE_IDS.join('|')}> [nivel]`)
  process.exit(1)
}
const lang = language as LanguageId
const info = languageInfo(lang)
const FILE = join(resolve(import.meta.dirname, '..', '..', 'content'), lang, 'vocabulario.json')
const words: CoreWord[] = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as { words: CoreWord[] }).words : []
const save = (): void => writeFileSync(FILE, `${JSON.stringify({ words }, null, 2)}\n`)

const batchSchema = z.object({ words: z.array(coreWordSchema.omit({ level: true }).catch(null as unknown as Omit<CoreWord, 'level'>)) })

for (const level of CEFR_LEVELS.filter((l) => !onlyLevel || l === onlyLevel)) {
  while (words.filter((w) => w.level === level).length < PER_LEVEL[level]) {
    const have = words.filter((w) => w.level === level).length
    const known = new Set(words.map((w) => w.term.toLowerCase()))
    const started = Date.now()
    const { words: batch } = await askClaude({
      label: 'vocabulario núcleo',
      effort: 'low',
      systemPrompt: roleSystemPrompt(lang, 'lexicógrafo', 'Elegís el vocabulario más frecuente y útil de cada nivel.'),
      prompt: `Armá el vocabulario núcleo del ${info.promptName} para hispanohablantes (${spanish()}). Variante: ${info.variant}
Necesito las palabras ${have + 1} a ${have + BATCH} del nivel ${level} (de ${PER_LEVEL[level]}), en orden de frecuencia de uso: las más frecuentes y útiles primero. Que sean propias del nivel ${level}: lo básico y cotidiano en A1, y más abstracto, formal o matizado a medida que sube.
Variá los temas (personas, casa, comida, trabajo, ciudad, viajes, salud, tiempo, emociones, naturaleza, tecnología, sociedad, verbos y adjetivos frecuentes, conectores). Los verbos van en infinitivo; los sustantivos, con el artículo si ayuda a saber el género.
No repitas ninguna de estas, que ya están: ${[...known].join(', ') || '(ninguna)'}
Campos, con estos nombres exactos: { words: [{ term, es, theme, example, exampleEs }] }, con ${BATCH} palabras.
- term: la palabra o expresión en ${info.name}; es: su traducción más común al ${spanish()}; theme: el tema en español.
- example: una oración corta y natural en ${info.name} que la use; exampleEs: su traducción.
${selfCheck(lang)}`,
      schema: batchSchema,
      timeoutMs: 300_000,
      ticket: { priority: 'now' }
    })
    const fresh = batch.filter((w): w is Omit<CoreWord, 'level'> => !!w && !known.has(w.term.toLowerCase()))
    for (const w of fresh) {
      known.add(w.term.toLowerCase())
      words.push({ ...w, level })
    }
    save()
    console.log(`${level}: +${fresh.length} (${have + fresh.length}/${PER_LEVEL[level]}) en ${Math.round((Date.now() - started) / 1000)} s`)
    if (fresh.length < 10) {
      console.error(`${level}: Claude casi no trajo palabras nuevas; se corta este nivel.`)
      break
    }
  }
}
shutdownClaude()
