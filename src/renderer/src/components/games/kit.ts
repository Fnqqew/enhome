// Utilidades compartidas por los juegos.

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
    .replace(/[.,!?;:¿¡"«»()… ]/g, ' ')
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

// Dictado: palabra por palabra; una tilde mal vale media palabra.
export function scoreDictation(typed: string, expected: string): { score: number; marks: { word: string; ok: 'yes' | 'accent' | 'no' }[] } {
  const want = normalizeText(expected).split(' ').filter(Boolean)
  const got = normalizeText(typed).split(' ').filter(Boolean)
  const marks = want.map((word, i) => {
    const given = got[i] ?? ''
    if (given === word) return { word, ok: 'yes' as const }
    if (withoutAccents(given) === withoutAccents(word)) return { word, ok: 'accent' as const }
    return { word, ok: 'no' as const }
  })
  const points = marks.reduce((sum, m) => sum + (m.ok === 'yes' ? 1 : m.ok === 'accent' ? 0.5 : 0), 0)
  return { score: want.length ? Math.round((points / want.length) * 100) : 0, marks }
}
