// Resúmenes: tipos disponibles, contenido y vistas.

import type { CefrLevel } from './curriculum'

export const SUMMARY_TYPE_IDS = [
  'completa',
  'esquema',
  'tablas',
  'ejemplos',
  'errores',
  'comparacion',
  'paso-a-paso',
  'historia',
  'dialogo',
  'simple',
  'preguntas',
  'trucos',
  'tarjetas'
] as const

export type SummaryTypeId = (typeof SUMMARY_TYPE_IDS)[number]
export type GeneratedSummaryType = Exclude<SummaryTypeId, 'completa'>

// La explicación completa es el resumen base del temario; el resto lo genera Claude.
export const BASE_SUMMARY_TYPE = 'completa' satisfies SummaryTypeId

export const SUMMARY_TYPES: Record<SummaryTypeId, { label: string; description: string }> = {
  completa: { label: 'Explicación completa', description: 'El resumen base del tópico, revisado, con todos los subtemas día por día.' },
  esquema: { label: 'Esquema', description: 'Lo esencial en viñetas cortas y ordenadas.' },
  tablas: { label: 'Tablas comparativas', description: 'Formas, usos y ejemplos lado a lado.' },
  ejemplos: { label: 'Ejemplos en contexto', description: 'Muchos ejemplos de situaciones cotidianas, con traducción.' },
  errores: { label: 'Errores comunes', description: 'Lo que suelen equivocar los hispanohablantes y cómo evitarlo.' },
  comparacion: { label: 'Comparación con el español', description: 'Qué funciona igual, qué cambia y qué no existe en español.' },
  'paso-a-paso': { label: 'Paso a paso', description: 'Cómo armar las oraciones, como una receta.' },
  historia: { label: 'Mini historia', description: 'Un relato corto que usa el tema, con traducción y notas.' },
  dialogo: { label: 'Diálogo', description: 'Una conversación cotidiana que usa el tema, línea por línea.' },
  simple: { label: 'Explicámelo simple', description: 'Lo mínimo indispensable, con palabras muy simples.' },
  preguntas: { label: 'Preguntas frecuentes', description: 'Las dudas típicas sobre el tema, respondidas.' },
  trucos: { label: 'Trucos para recordar', description: 'Reglas mnemotécnicas y atajos para no equivocarse.' },
  tarjetas: { label: 'Tarjetas de repaso', description: 'Preguntas y respuestas para repasar dando vuelta tarjetas.' }
}

export interface Flashcard {
  front: string
  back: string
  example: string
}

export type SummaryContent = { format: 'markdown'; markdown: string } | { format: 'cards'; cards: Flashcard[] }

export interface SummaryTypeView {
  id: SummaryTypeId
  label: string
  description: string
  favorite: boolean
  recommended: boolean
  averageRating: number | null
}

export interface SummaryTopicOption {
  id: string
  title: string
  level: CefrLevel
  status: 'current' | 'passed' | 'review'
}

export type SummariesIndex =
  | { unlocked: false; reason: string }
  | { unlocked: true; currentTopicId: string | null; topics: SummaryTopicOption[]; types: SummaryTypeView[] }

export interface SummaryView {
  topicId: string
  topicTitle: string
  level: CefrLevel
  type: SummaryTypeId
  content: SummaryContent | null
  source: 'base' | 'ai' | null
  rating: number | null
  generatedAt: string | null
  // Tipos ya generados para este tópico.
  generatedTypes: SummaryTypeId[]
}

export interface ClaudeAnswer {
  answer: string
}
