// Certificado de nivel: al aprobar todos los tópicos de A1, A2, etc.

import type { CefrLevel } from './curriculum'

export interface CertificateView {
  level: CefrLevel
  levelName: string
  complete: boolean
  passedTopics: number
  totalTopics: number
  // Día en que se aprobó el último tópico del nivel.
  completedOn: string | null
  average: number | null
  topics: { title: string; grade: number | null }[]
}
