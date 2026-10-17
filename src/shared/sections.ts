// Las secciones de la app, compartidas entre la interfaz y los comentarios guardados.

export const SECTION_GROUPS = [
  { id: 'estudio', label: 'Estudiar' },
  { id: 'extra', label: 'Practicar más' },
  { id: 'app', label: 'Ajustes y ayuda' }
] as const

export type SectionGroup = (typeof SECTION_GROUPS)[number]['id']

export const SECTIONS = [
  { id: 'inicio', label: 'Inicio', group: 'estudio' },
  { id: 'temario', label: 'Temario', group: 'estudio' },
  { id: 'practica', label: 'Práctica', group: 'estudio' },
  { id: 'repaso', label: 'Repaso', group: 'estudio' },
  { id: 'resumenes', label: 'Resúmenes', group: 'estudio' },
  { id: 'pruebas', label: 'Pruebas', group: 'estudio' },
  { id: 'progreso', label: 'Progreso', group: 'estudio' },
  { id: 'estadisticas', label: 'Estadísticas', group: 'estudio' },
  { id: 'juegos', label: 'Juegos', group: 'extra' },
  { id: 'lecturas', label: 'Lecturas', group: 'extra' },
  { id: 'diario', label: 'Diario', group: 'extra' },
  { id: 'biblioteca', label: 'Biblioteca', group: 'extra' },
  { id: 'ajustes', label: 'Ajustes', group: 'app' },
  { id: 'ayuda', label: 'Ayuda', group: 'app' },
  { id: 'comentarios', label: 'Comentarios', group: 'app' },
  { id: 'acerca', label: 'Acerca de', group: 'app' }
] as const satisfies readonly { id: string; label: string; group: SectionGroup }[]

export type SectionId = (typeof SECTIONS)[number]['id']

export const SECTION_LABELS: Record<SectionId, string> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label])) as Record<SectionId, string>
