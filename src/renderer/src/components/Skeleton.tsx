// Esqueleto de carga: formas grises que anticipan el contenido en vez de «Cargando…».

export function SkeletonCard({ lines = 3, title = true }: { lines?: number; title?: boolean }): React.JSX.Element {
  return (
    <section className="card stack skeleton-card" aria-busy="true" aria-label="Cargando">
      {title && <span className="skeleton skeleton-title" />}
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton skeleton-line" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </section>
  )
}

// Una página entera: un título y dos tarjetas.
export default function PageSkeleton({ cards = 2 }: { cards?: number }): React.JSX.Element {
  return (
    <>
      <span className="skeleton skeleton-heading" aria-hidden="true" />
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} lines={i === 0 ? 3 : 4} />
      ))}
    </>
  )
}
