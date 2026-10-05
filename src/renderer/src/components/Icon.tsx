import type { SectionId } from '@shared/sections'

// Íconos de línea propios: toman el color del texto, así siguen al estilo y al tema.
const PATHS: Record<SectionId, React.JSX.Element> = {
  inicio: <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  temario: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h12v14h-12a2 2 0 0 0-2 2z" />
      <path d="M4.5 19.5a2 2 0 0 0 2 2h12v-4" />
      <path d="M9 8h6M9 11.5h4" />
    </>
  ),
  practica: (
    <>
      <path d="M15.5 4.5l4 4L9 19H5v-4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  resumenes: (
    <>
      <path d="M6 3.5h8.5l4 4v13H6z" />
      <path d="M14 3.5v4.5h4.5M9 12.5h6.5M9 16h4.5" />
    </>
  ),
  pruebas: (
    <>
      <path d="M9 3.5h6v3H9z" />
      <path d="M7 5H5.5v15.5h13V5H17" />
      <path d="M9 13.5l2 2 4-4" />
    </>
  ),
  progreso: <path d="M12 3c.8 3.2 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.6 1.4-4.2 2.6-5.3.1 2 1 3.2 2.5 3.3-.9-3-.8-5.6-.1-8.2z" />,
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  comentarios: <path d="M4 5h16v11H9.5L5 20v-4H4z" />,
  acerca: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  )
}

export default function Icon({ name, className }: { name: SectionId; className?: string }): React.JSX.Element {
  return (
    <svg
      className={className ?? 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
