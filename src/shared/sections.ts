// Las secciones de la app, compartidas entre la interfaz y los comentarios guardados.

export const SECTIONS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'temario', label: 'Temario' },
  { id: 'practica', label: 'Práctica' },
  { id: 'resumenes', label: 'Resúmenes' },
  { id: 'pruebas', label: 'Pruebas' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'comentarios', label: 'Comentarios' },
  { id: 'acerca', label: 'Acerca de' }
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export const SECTION_LABELS: Record<SectionId, string> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label])) as Record<SectionId, string>
