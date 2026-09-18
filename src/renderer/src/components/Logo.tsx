import type { StyleId } from '@shared/settings'
import LOGOS from '@shared/logos.json'

// Logo de cada estilo visual. El dibujo vive en logos.json porque también lo usa el generador del ícono.
export default function Logo({ style, className }: { style: StyleId; className?: string }): React.JSX.Element {
  return (
    <svg
      className={className ?? 'logo'}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Proyecto Inglés"
      dangerouslySetInnerHTML={{ __html: LOGOS[style] }}
    />
  )
}
