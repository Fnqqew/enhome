// Versiones publicadas en GitHub: qué hay nuevo y si se puede instalar desde la app.

export interface UpdateInfo {
  current: string
  latest: string
  newer: boolean
  // Página de la versión en GitHub y lo que trae (las notas de la publicación).
  url: string
  notes: string
  // Se puede bajar e instalar desde la app (hace falta la CLI de GitHub con sesión y la app instalada).
  canInstall: boolean
}

// «v2.0.0» → [2, 0, 0]. Lo que no es número cuenta como 0.
function parts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0)
}

// Negativo si a es anterior a b, positivo si es posterior, 0 si son la misma versión.
export function compareVersions(a: string, b: string): number {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
