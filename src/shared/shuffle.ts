export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Mezcla opciones de opción múltiple manteniendo apuntada la correcta.
export function shuffleChoices(
  options: string[],
  correctIndex: number,
  random: () => number = Math.random
): { options: string[]; correctIndex: number } {
  const order = shuffled(
    options.map((_, i) => i),
    random
  )
  return { options: order.map((i) => options[i]), correctIndex: order.indexOf(correctIndex) }
}
