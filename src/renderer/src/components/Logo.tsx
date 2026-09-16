import type { StyleId } from '@shared/settings'

// Logo de cada estilo visual. Los colores son fijos: el logo se ve igual en modo claro y oscuro.
export default function Logo({ style, className }: { style: StyleId; className?: string }): React.JSX.Element {
  return (
    <svg className={className ?? 'logo'} viewBox="0 0 64 64" role="img" aria-label="Proyecto Inglés">
      {MARKS[style]}
    </svg>
  )
}

const MARKS: Record<StyleId, React.JSX.Element> = {
  celeste: (
    <>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#FFFFFF" stroke="#D5E2EE" strokeWidth="2" />
      <path d="M11 12h24a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-7 6v-6h-4a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#4BA3E3" />
      <path d="M53 25H31a6 6 0 0 0-6 6v12a6 6 0 0 0 6 6h12l7 6v-6h3a6 6 0 0 0 6-6V31a6 6 0 0 0-6-6z" fill="#0B3C6D" />
      <text x="14" y="29" fontFamily="'Plus Jakarta Sans Variable', sans-serif" fontWeight="800" fontSize="11" fill="#fff">
        ES
      </text>
      <text x="34" y="42" fontFamily="'Plus Jakarta Sans Variable', sans-serif" fontWeight="800" fontSize="11" fill="#fff">
        EN
      </text>
      <circle cx="54" cy="12" r="4" fill="#F2B33D" />
    </>
  ),
  ruta: (
    <>
      <rect width="64" height="64" rx="16" fill="#0F1B33" />
      <path d="M12 42H29L39 22H52" stroke="#1E9E6A" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="42" r="5" fill="#fff" />
      <circle cx="29" cy="42" r="5" fill="#fff" />
      <circle cx="52" cy="22" r="6.5" fill="#0F1B33" stroke="#fff" strokeWidth="4" />
    </>
  ),
  cuaderno: (
    <>
      <rect x="1" y="1" width="62" height="62" rx="12" fill="#FBFBF8" stroke="#DCE3EE" strokeWidth="2" />
      <g stroke="#DCE3EE" strokeWidth="1.5">
        <line x1="1" y1="22" x2="63" y2="22" />
        <line x1="1" y1="34" x2="63" y2="34" />
        <line x1="1" y1="46" x2="63" y2="46" />
      </g>
      <line x1="15" y1="1" x2="15" y2="63" stroke="#E0524B" strokeWidth="2" />
      <rect x="21" y="36" width="32" height="10" fill="#FFE45C" />
      <text x="21" y="45" fontFamily="'Literata Variable', Georgia, serif" fontStyle="italic" fontSize="26" fontWeight="600" fill="#2446B8">
        Aa
      </text>
    </>
  ),
  racha: (
    <>
      <path
        d="M14 7h36a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H31l-13 9v-9h-4A10 10 0 0 1 4 39V17A10 10 0 0 1 14 7z"
        fill="#FF6B4A"
        stroke="#2E2E2E"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M32 14c2 6 9 9 9 17a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 2 5 4 5-1-5-1-9 1-14z"
        fill="#FFC53D"
        stroke="#2E2E2E"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </>
  ),
  original: (
    <>
      <rect width="64" height="64" rx="14" fill="#3F5BD0" />
      <text x="32" y="42" textAnchor="middle" fontFamily="'Segoe UI', sans-serif" fontWeight="700" fontSize="26" fill="#fff">
        PI
      </text>
    </>
  )
}
