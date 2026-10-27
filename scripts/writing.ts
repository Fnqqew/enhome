// Escribe con Claude el curso de escritura de un idioma con otro alfabeto (content/<idioma>/escritura.json),
// con revisión aparte. Uso: npm run content:writing -- <idioma>

import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { askClaude, shutdownClaude } from '../src/main/claude/bridge'
import { REVIEW_EFFORT, reviewSystemPrompt, roleSystemPrompt, selfCheck, spanish } from '../src/main/claude/quality'
import { LANGUAGE_IDS, languageInfo, type LanguageId } from '../src/shared/languages'
import { writingSchema } from '../src/shared/writing'

const [language] = process.argv.slice(2)
if (!LANGUAGE_IDS.includes(language as LanguageId) || languageInfo(language as LanguageId).script === 'latin') {
  console.error('Uso: npm run content:writing -- <ru|ja|zh|ko> (los idiomas con otro alfabeto)')
  process.exit(1)
}
const lang = language as LanguageId
const info = languageInfo(lang)
const FILE = join(resolve(import.meta.dirname, '..', '..', 'content'), lang, 'escritura.json')

// Qué cubre el curso en cada escritura.
const SCOPE: Record<string, string> = {
  cyrillic:
    'las 33 letras del alfabeto cirílico ruso, en grupos: las que se parecen y suenan como en español, las «falsas amigas» (se parecen a una letra latina pero suenan distinto), las nuevas, y los signos duro y blando; más la letra cursiva y el acento.',
  japanese:
    'el hiragana completo (por filas: vocales, k, s, t, n, h, m, y, r, w y n; después las variantes con dakuten y las combinadas con ya, yu y yo), el katakana completo por filas y unos 30 kanji muy básicos (números, días, persona, grande, chico, agua, fuego…).',
  chinese:
    'el pinyin (iniciales, finales y los cuatro tonos más el neutro, con sus marcas) y unos 120 caracteres simplificados básicos agrupados por tema (números, personas, tiempo, verbos frecuentes, lugares), más los radicales más comunes.',
  hangul:
    'el hangul completo: las consonantes básicas, las aspiradas y las tensas, las vocales simples y compuestas, cómo se arman los bloques de sílaba y las consonantes finales (batchim).'
}

const fields = `Campos, con estos nombres exactos: { intro, romanization, keyboard, groups: [{ title, description, characters: [{ char, roman, example: { word, roman, es } }] }] }`

const course = await askClaude({
  label: 'escritura',
  effort: 'medium',
  systemPrompt: roleSystemPrompt(lang, 'docente', 'Enseñás a leer y escribir un alfabeto nuevo de a poco, comparando con el español.'),
  prompt: `Armá el curso de lectura y escritura del ${info.promptName} para hispanohablantes (${spanish()}) que recién empiezan. Cubrí ${SCOPE[info.script]}
${fields}
- intro: dos o tres oraciones sobre cómo funciona esta escritura y por dónde conviene empezar.
- romanization: qué romanización se usa en el curso y por qué conviene dejarla de lado de a poco.
- keyboard: cómo agregar el teclado de este idioma en Windows 11 (Configuración → Hora e idioma → Idioma y región) y cómo se escribe con él (por ejemplo, el IME que convierte lo tecleado), en pasos cortos.
- groups: en el orden en que conviene aprender; title y description en ${spanish()} (description: qué tienen en común y cómo se pronuncian, comparado con el español).
- characters: char es el carácter; roman, su romanización; example, una palabra real y frecuente que lo use, con su romanización y su significado en español.
${selfCheck(lang)}`,
  schema: writingSchema,
  timeoutMs: 600_000,
  ticket: { priority: 'now' }
})

const reviewed = await askClaude({
  label: 'escritura · revisión',
  effort: REVIEW_EFFORT,
  systemPrompt: reviewSystemPrompt(lang),
  prompt: `Otro docente armó este curso de escritura del ${info.promptName} para hispanohablantes. Revisalo con ojo de experto: que cada carácter, su romanización y sus ejemplos sean correctos, que no falte ninguno de lo que tiene que cubrir (${SCOPE[info.script]}) y que los pasos del teclado sean los de Windows 11. Devolvelo corregido entero, con los mismos campos; lo que está bien, dejalo igual.
${fields}

${JSON.stringify(course)}`,
  schema: writingSchema,
  timeoutMs: 600_000,
  ticket: { priority: 'now' }
})
shutdownClaude()

writeFileSync(FILE, `${JSON.stringify(reviewed, null, 2)}\n`)
const count = reviewed.groups.reduce((sum, g) => sum + g.characters.length, 0)
console.log(`Curso de escritura de ${info.name}: ${reviewed.groups.length} grupos y ${count} caracteres`)
