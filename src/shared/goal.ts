// Meta diaria del curso abierto.

export interface GoalView {
  kind: 'minutes' | 'activities' | 'off'
  target: number
  done: number
  met: boolean
}

export const goalUnit = (goal: GoalView, amount: number): string =>
  goal.kind === 'minutes' ? (amount === 1 ? 'minuto' : 'minutos') : amount === 1 ? 'actividad' : 'actividades'
