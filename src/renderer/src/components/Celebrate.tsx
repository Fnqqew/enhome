import { useEffect, useState } from 'react'
import { play } from '../sounds'

const SPARKS = 10

// Celebración sutil al cerrar bien (práctica perfecta, examen aprobado, récord): un anillo que se
// expande y unas chispas que salen del centro, menos de un segundo. Con animaciones reducidas no aparece.
export default function Celebrate({ active }: { active: boolean }): React.JSX.Element | null {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) return
    play('celebrate')
    const reduced = document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    setShow(true)
    const timer = setTimeout(() => setShow(false), 1400)
    return () => clearTimeout(timer)
  }, [active])

  if (!show) return null
  return (
    <div className="celebrate" aria-hidden="true">
      <span className="celebrate-ring" />
      {Array.from({ length: SPARKS }, (_, i) => (
        <span
          key={i}
          className="celebrate-spark"
          style={{ '--angle': `${(360 / SPARKS) * i}deg`, '--delay': `${(i % 3) * 40}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
