interface Option<T extends string> {
  value: T
  label: string
  style?: React.CSSProperties
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}

export default function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>): React.JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} style={o.style} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
