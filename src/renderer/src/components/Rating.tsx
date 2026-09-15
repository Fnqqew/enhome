import type { PracticeRating } from '@shared/exercises'

const RATINGS: { value: PracticeRating; label: string }[] = [
  { value: 1, label: 'No me sirvió' },
  { value: 3, label: 'Estuvo bien' },
  { value: 5, label: 'Me encantó' }
]

export default function Rating({
  value,
  onRate,
  label = '¿Qué te pareció?'
}: {
  value: number | null
  onRate: (rating: PracticeRating) => void
  label?: string
}): React.JSX.Element {
  return (
    <div className="rating" role="group" aria-label={label}>
      <span className="muted">{label}</span>
      {RATINGS.map((r) => (
        <button key={r.value} type="button" className="chip" aria-pressed={value === r.value} onClick={() => onRate(r.value)}>
          {r.label}
        </button>
      ))}
    </div>
  )
}
