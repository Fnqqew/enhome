export type { SectionId } from '@shared/sections'
export { SECTIONS, SECTION_LABELS } from '@shared/sections'

import type { SectionId } from '@shared/sections'

// Datos extra para abrir una sección en un lugar puntual (por ejemplo, el repaso de un examen).
export interface NavParams {
  examId?: number
}

export type Navigate = (section: SectionId, params?: NavParams) => void
