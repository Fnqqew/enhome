// La dificultad de la práctica, en escalones: se arranca guiado y se sube de a uno cuando el alumno
// acierta casi todo un par de veces seguidas; si una práctica sale muy mal, se baja uno.

export const DIFFICULTIES = ['guided', 'normal', 'harder'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  guided: 'Guiada',
  normal: 'Normal',
  harder: 'Exigente'
}

// Con cuánto acierto una práctica cuenta para subir, cuántas seguidas hacen falta y debajo de cuánto se baja.
export const STEP_UP_RATIO = 0.8
export const STEP_UP_STREAK = 2
export const STEP_DOWN_RATIO = 0.5

export interface DifficultyState {
  difficulty: Difficulty
  // Cuántas prácticas seguidas con 80 % o más lleva en este escalón.
  streak: number
}

// El escalón al que se llega con los resultados de las prácticas terminadas (aciertos sobre el total de
// cada una, en orden).
export function difficultyFrom(ratios: number[]): DifficultyState {
  let step = 0
  let streak = 0
  for (const ratio of ratios) {
    if (ratio >= STEP_UP_RATIO) {
      streak++
      if (streak >= STEP_UP_STREAK && step < DIFFICULTIES.length - 1) {
        step++
        streak = 0
      }
    } else if (ratio < STEP_DOWN_RATIO) {
      step = Math.max(0, step - 1)
      streak = 0
    } else {
      streak = 0
    }
  }
  return { difficulty: DIFFICULTIES[step], streak }
}

// El archivo del banco de cada escalón (content/<idioma>/<nivel>/<tópico>/).
export const BANK_FILES: Record<Difficulty, string> = {
  guided: 'banco-guiado.json',
  normal: 'banco.json',
  harder: 'banco-exigente.json'
}
