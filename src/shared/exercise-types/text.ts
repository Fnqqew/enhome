// Comparar lo que escribió el alumno con las respuestas aceptadas, sin castigar diferencias que no importan.

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will']
]

export function normalize(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[\s.!?;:,"]+$/g, '')
    .replace(/^["¿¡\s]+/, '')
}

// Forma canónica: sin contracciones ni comas, para no penalizar variantes equivalentes.
function canonical(value: string): string {
  let result = normalize(value)
  for (const [pattern, replacement] of CONTRACTIONS) result = result.replace(pattern, replacement)
  return result.replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

export function matchesAny(answer: string, accepted: string[]): boolean {
  const value = canonical(answer)
  return value !== '' && accepted.some((option) => canonical(option) === value)
}

// Distancia de edición con transposiciones («becuase» → «because» es un solo error).
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// Hasta dónde coinciden dos palabras desde el principio y desde el final.
function sharedEnds(a: string, b: string): { start: number; end: number } {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
  return { start, end }
}

export interface Typo {
  typed: string
  intended: string
  expected: string
}

// Un error de tipeo, no de gramática: una sola palabra distinta, larga, a un error de distancia y
// sin tocar el final, que es donde están las terminaciones que se practican (works/work, falou/falei).
// Ante la duda devuelve null y corrige Claude.
export function findTypo(answer: string, accepted: string[]): Typo | null {
  const words = canonical(answer).split(' ')
  for (const option of accepted) {
    const expected = canonical(option).split(' ')
    if (expected.length !== words.length) continue
    const differing = expected.flatMap((word, i) => (word === words[i] ? [] : [i]))
    if (differing.length !== 1) continue
    const typed = words[differing[0]]
    const intended = expected[differing[0]]
    if (typed.length < 5 || intended.length < 5 || editDistance(typed, intended) !== 1) continue
    if (sharedEnds(typed, intended).end < 2) continue
    return { typed, intended, expected: option }
  }
  return null
}

export const typoNote = (typo: Typo): string => `Ojo con la ortografía: escribiste «${typo.typed}», se escribe «${typo.intended}».`

export function tokenize(sentence: string): string[] {
  return sentence
    .trim()
    .replace(/[.!?]+$/, '')
    .split(/\s+/)
    .filter(Boolean)
}

// Las primeras palabras de una respuesta, para dar una pista sin revelarla.
export const firstWords = (text: string, count = 2): string => text.split(/\s+/).slice(0, count).join(' ')

export const quoted = (items: string[]): string => {
  const parts = items.map((item) => `«${item}»`)
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
