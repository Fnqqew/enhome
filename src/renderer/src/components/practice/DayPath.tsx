// El recorrido del día: calentamiento (si hay repasos), microlección, práctica y cierre.

export type DayStep = 'warmup' | 'lesson' | 'practice' | 'close'

const LABELS: Record<DayStep, string> = {
  warmup: 'Calentamiento',
  lesson: 'Microlección',
  practice: 'Práctica',
  close: 'Cierre'
}

export default function DayPath({ current, warmUp }: { current: DayStep; warmUp: boolean }): React.JSX.Element {
  const steps: DayStep[] = warmUp ? ['warmup', 'lesson', 'practice', 'close'] : ['lesson', 'practice', 'close']
  const at = steps.indexOf(current)
  return (
    <ol className="day-path" aria-label="El día de hoy">
      {steps.map((step, i) => (
        <li key={step} className={i < at ? 'done' : i === at ? 'current' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="day-path-dot" aria-hidden="true">
            {i + 1}
          </span>
          {LABELS[step]}
        </li>
      ))}
    </ol>
  )
}
