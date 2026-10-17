// Utilidades de los juegos (puras: se usan en la interfaz y se prueban sin ella).

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function sample<T>(items: readonly T[], count: number): T[] {
  return shuffle(items).slice(0, count)
}

// Sin repetidos según una clave (por ejemplo, la misma frase en dos subtemas).
export function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Para comparar lo escrito: minúsculas, sin signos de puntuación y con un solo espacio.
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:¿¡"«»()…\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function withoutAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Opciones para una pregunta: la correcta más distractores distintos entre sí, mezcladas.
export function choices<T>(correct: T, pool: readonly T[], count: number, key: (item: T) => string): { options: T[]; answer: number } {
  const distractors = sample(
    unique(
      pool.filter((item) => key(item) !== key(correct)),
      key
    ),
    count - 1
  )
  const options = shuffle([correct, ...distractors])
  return { options, answer: options.findIndex((o) => key(o) === key(correct)) }
}

// Dictado y pronunciación: se alinean las palabras (la subsecuencia común más larga, sin mirar
// tildes), así una palabra de más o de menos no corre todas las demás. Una tilde mal vale media palabra.
export function scoreDictation(typed: string, expected: string): { score: number; marks: { word: string; ok: 'yes' | 'accent' | 'no' }[] } {
  const want = normalizeText(expected).split(' ').filter(Boolean)
  const got = normalizeText(typed).split(' ').filter(Boolean)
  const a = want.map(withoutAccents)
  const b = got.map(withoutAccents)
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const matched = new Map<number, number>()
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) {
      matched.set(i, j)
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  const marks = want.map((word, i) => {
    const j = matched.get(i)
    if (j === undefined) return { word, ok: 'no' as const }
    return { word, ok: got[j] === word ? ('yes' as const) : ('accent' as const) }
  })
  const points = marks.reduce((sum, m) => sum + (m.ok === 'yes' ? 1 : m.ok === 'accent' ? 0.5 : 0), 0)
  return { score: want.length ? Math.round((points / want.length) * 100) : 0, marks }
}
