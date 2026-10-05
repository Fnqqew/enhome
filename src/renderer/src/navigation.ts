export type { SectionId } from '@shared/sections'
export { SECTIONS, SECTION_LABELS } from '@shared/sections'

import type { SectionId } from '@shared/sections'

export type Navigate = (section: SectionId) => void
