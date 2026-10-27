// Escribe con Claude la guía de pronunciación de un idioma (content/<idioma>/pronunciacion.json), con
// revisión aparte. Uso: npm run content:pronunciation -- <idioma>

import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { REVIEW_EFFORT, reviewSystemPrompt, roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'
import { pronunciationSchema } from '../src/shared/pronunciation'

const [language] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId)) {
  console.error(`Uso: npm run content:pronunciation -- <${LANGUAGE_IDS.join('|')}>`)
  process.exit(1)
}
const lang = language as LanguageId
const info = languageInfo(lang)
const FILE = join(resolve(import.meta.dirname, '..', '..', 'content'), lang, 'pronunciacion.json')

const fields = `Campos, con estos nombres exactos: { intro, sounds: [{ title, description, examples: [{ target, es }], tip }], pairs: [{ a, b, meaningA, meaningB, note }], stress, intonation, variants }`

const guide = await askClaude({
  label: 'pronunciación',
  effort: 'medium',
  systemPrompt: roleSystemPrompt(lang, 'fonetista', 'Explicás la pronunciación con claridad, sin jerga, comparando con el español.'),
  prompt: `Escribí la guía de pronunciación del ${info.promptName} para hispanohablantes (${spanish()}). Variante: ${info.variant}
Todo se va a escuchar con una voz sintética del idioma, así que los ejemplos son palabras u oraciones reales, escritas normalmente (sin transcripción fonética).
${fields}
- intro: dos o tres oraciones sobre qué cuesta más al pronunciar este idioma viniendo del español.
- sounds: de 6 a 12 sonidos o rasgos que no existen en español o que se pronuncian distinto (vocales, consonantes, nasales, sonidos que cambian según la posición), ordenados de más a menos importante. title corto; description de cómo se hace comparando con el español; examples con 3 a 5 palabras u oraciones cortas y su traducción; tip con un consejo práctico para practicarlo.
- pairs: de 6 a 12 pares mínimos reales (dos palabras que cambian en un solo sonido difícil para hispanohablantes), con lo que significa cada una y una nota breve de qué sonido cambia.
- stress: cómo funciona el acento de las palabras (dónde cae, tildes, sílabas que se reducen), en un párrafo.
- intonation: la entonación de preguntas, afirmaciones y del habla rápida, en un párrafo.
- variants: las diferencias de pronunciación más notorias entre las variantes del idioma, en un párrafo.
${selfCheck(lang)}`,
  schema: pronunciationSchema,
  timeoutMs: 300_000,
  ticket: { priority: 'now' }
})

const reviewed = await askClaude({
  label: 'pronunciación · revisión',
  effort: REVIEW_EFFORT,
  systemPrompt: reviewSystemPrompt(lang),
  prompt: `Otro fonetista escribió esta guía de pronunciación del ${info.promptName} para hispanohablantes. Revisala con ojo de experto: que lo que dice de cada sonido sea correcto, que los pares mínimos existan y se diferencien en un solo sonido, que los significados estén bien y que la variante sea coherente (${info.variant}). Devolvela corregida entera, con los mismos campos; lo que está bien, dejalo igual.
${fields}

${JSON.stringify(guide)}`,
  schema: pronunciationSchema,
  timeoutMs: 300_000,
  ticket: { priority: 'now' }
})
shutdownClaude()

writeFileSync(FILE, `${JSON.stringify(reviewed, null, 2)}\n`)
console.log(`Guía de pronunciación de ${info.name}: ${reviewed.sounds.length} sonidos y ${reviewed.pairs.length} pares mínimos`)
