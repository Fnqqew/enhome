export type { SectionId } from '@shared/sections'
export { SECTION_GROUPS, SECTIONS, SECTION_LABELS } from '@shared/sections'

import type { SectionId } from '@shared/sections'

// Datos extra para abrir una sección en un lugar puntual (por ejemplo, el repaso de un examen).
export interface NavParams {
  examId?: number
  // Tópico para abrir en el Temario (desde el buscador).
  topicId?: string
}

export type Navigate = (section: SectionId, params?: NavParams) => void
