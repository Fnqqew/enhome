export type SectionId = 'inicio' | 'temario' | 'practica' | 'resumenes' | 'pruebas' | 'progreso' | 'ajustes'

export type Navigate = (section: SectionId) => void
