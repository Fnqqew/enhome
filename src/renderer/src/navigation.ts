export type SectionId = 'inicio' | 'practica' | 'resumenes' | 'pruebas' | 'progreso' | 'ajustes'

export type Navigate = (section: SectionId) => void
