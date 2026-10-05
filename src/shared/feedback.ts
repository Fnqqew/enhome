// Comentarios del usuario sobre la app: quedan guardados en la base, no se envían a ningún lado.

import { z } from 'zod'
import type { SectionId } from './sections'

export const FEEDBACK_KINDS = [
  { id: 'idea', label: 'Idea', icon: '💡', hint: 'Algo que te gustaría que la app haga' },
  { id: 'problema', label: 'Algo falla', icon: '🐞', hint: 'Algo que no anda o se ve mal' },
  { id: 'gusto', label: 'Me gusta', icon: '⭐', hint: 'Algo que querés que quede como está' }
] as const

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['id']

export const newFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS.map((k) => k.id) as [FeedbackKind, ...FeedbackKind[]]),
  section: z.string().max(40),
  message: z.string().trim().min(3).max(2000)
})

export type NewFeedback = z.infer<typeof newFeedbackSchema>

export interface FeedbackNote extends NewFeedback {
  id: number
  section: SectionId | 'general'
  done: boolean
  createdAt: string
}
