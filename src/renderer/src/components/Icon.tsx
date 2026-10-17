import type { IconName } from '@shared/icons'

const BOOK = (
  <>
    <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h12v14h-12a2 2 0 0 0-2 2z" />
    <path d="M4.5 19.5a2 2 0 0 0 2 2h12v-4" />
    <path d="M9 8h6M9 11.5h4" />
  </>
)
const PENCIL = (
  <>
    <path d="M15.5 4.5l4 4L9 19H5v-4z" />
    <path d="M13.5 6.5l4 4" />
  </>
)
const PAGE = (
  <>
    <path d="M6 3.5h8.5l4 4v13H6z" />
    <path d="M14 3.5v4.5h4.5M9 12.5h6.5M9 16h4.5" />
  </>
)
const FLAME = <path d="M12 3c.8 3.2 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.6 1.4-4.2 2.6-5.3.1 2 1 3.2 2.5 3.3-.9-3-.8-5.6-.1-8.2z" />
const CHAT = <path d="M4 5h16v11H9.5L5 20v-4H4z" />
const STAR = <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />

// Íconos de línea propios: toman el color del texto, así siguen al estilo y al tema.
const PATHS: Record<IconName, React.JSX.Element> = {
  inicio: <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  temario: BOOK,
  practica: PENCIL,
  repaso: (
    <>
      <path d="M4.5 11.5a7.5 7.5 0 0 1 13.3-4.3l1.7 1.8" />
      <path d="M19.5 4v5h-5" />
      <path d="M19.5 12.5a7.5 7.5 0 0 1-13.3 4.3L4.5 15" />
      <path d="M4.5 20v-5h5" />
    </>
  ),
  juegos: (
    <>
      <path d="M7.5 8.5h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.8a2.2 2.2 0 0 1-3.8 1L14.5 16.5h-5l-1.8 2.2a2.2 2.2 0 0 1-3.8-1l-.8-3.8a4.5 4.5 0 0 1 4.4-5.4z" />
      <path d="M8 11.5v3M6.5 13h3M15.5 12h.01M17.5 14h.01" />
    </>
  ),
  lecturas: (
    <>
      <path d="M12 6.5c-2-1.6-4.6-2-8-1.8v13c3.4-.2 6 .2 8 1.8 2-1.6 4.6-2 8-1.8v-13c-3.4-.2-6 .2-8 1.8z" />
      <path d="M12 6.5v13" />
    </>
  ),
  diario: (
    <>
      <path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11z" />
      <path d="M6.5 3.5v17M4.5 7.5h4M4.5 12h4M4.5 16.5h4M11 8h5M11 11.5h5" />
    </>
  ),
  resumenes: PAGE,
  pruebas: (
    <>
      <path d="M9 3.5h6v3H9z" />
      <path d="M7 5H5.5v15.5h13V5H17" />
      <path d="M9 13.5l2 2 4-4" />
    </>
  ),
  progreso: FLAME,
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  comentarios: CHAT,
  acerca: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 17.5h5M10.5 20.5h3" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5v.5h5V15c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 12 3.5z" />
    </>
  ),
  retry: (
    <>
      <path d="M4.5 11.5a7.5 7.5 0 0 1 13.3-4.3l1.7 1.8" />
      <path d="M19.5 4v5h-5" />
      <path d="M19.5 12.5a7.5 7.5 0 0 1-13.3 4.3L4.5 15" />
      <path d="M4.5 20v-5h5" />
    </>
  ),
  shield: <path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.3z" />,
  play: <path d="M8 5.5v13l10-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  stop: <path d="M7 7h10v10H7z" />,
  star: STAR,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  bug: (
    <>
      <path d="M8.5 10a3.5 3.5 0 0 1 7 0v4.5a3.5 3.5 0 0 1-7 0z" />
      <path d="M12 10v8M4.5 13h4M15.5 13h4M5.5 8.5l3 1.5M18.5 8.5l-3 1.5M5.5 18l3-1.5M18.5 18l-3-1.5M10 6.8 9 4.5M14 6.8l1-2.3" />
    </>
  ),
  flame: FLAME,
  chat: CHAT,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  pencil: PENCIL,
  cap: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.5v4c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4M21.5 9.5v5" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="M9 10.8 7 3.5h3.5L12 7l1.5-3.5H17l-2 7.3" />
    </>
  ),
  trend: (
    <>
      <path d="M4 17l5.5-5.5 3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </>
  ),
  book: BOOK,
  landmark: (
    <>
      <path d="M3.5 9 12 4l8.5 5z" />
      <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3.5 20.5h17" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-9.5v-6" />
      <path d="M7.5 15h9" />
    </>
  ),
  page: PAGE,
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6h-3a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5v4M8 20.5h8" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  calendar: (
    <>
      <path d="M4.5 6.5h15v13h-15z" />
      <path d="M4.5 10.5h15M8.5 4v4M15.5 4v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 4.2 2.5 6.6 6.5 7.5-4 .9-5.9 3.3-6.5 7.5-.6-4.2-2.5-6.6-6.5-7.5 4-.9 5.9-3.3 6.5-7.5z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  chevron: <path d="M14.5 6.5 9 12l5.5 5.5" />,
  focus: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
  mic: (
    <>
      <path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3z" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6" />
    </>
  )
}

// filled rellena la forma (por ejemplo, la estrella de favorito marcada).
export default function Icon({ name, className, filled = false }: { name: IconName; className?: string; filled?: boolean }): React.JSX.Element {
  return (
    <svg
      className={className ?? 'icon'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
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
