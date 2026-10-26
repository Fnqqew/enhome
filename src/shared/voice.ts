// Voces neuronales sin conexión. Cada idioma declara las suyas en su ficha (content/<id>/idioma.json):
// la primera es la de siempre y la segunda, de otro género, hace de interlocutor en los diálogos.
// Piper suena al instante (unos 0,4 s por frase); Supertonic cubre idiomas que Piper no tiene, como
// japonés y coreano, y tarda unos 2,5 s por frase (se usa con audio pregenerado).

import { z } from 'zod'

export const VOICE_ENGINES = ['piper', 'supertonic'] as const
export type VoiceEngine = (typeof VOICE_ENGINES)[number]

export const voiceSchema = z.object({
  // Piper: el nombre de la voz (en_US-amy-medium). Supertonic: supertonic-<sid>.
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  engine: z.enum(VOICE_ENGINES),
  label: z.string().min(1),
  gender: z.enum(['mujer', 'hombre']),
  // De dónde es el acento («Estados Unidos», «Brasil»).
  accent: z.string().min(1),
  // Supertonic: qué voz del modelo (0 a 4 mujeres, 5 a 9 hombres) y el código de idioma.
  sid: z.number().int().min(0).optional(),
  lang: z.string().optional()
})

export type Voice = z.infer<typeof voiceSchema>

// La voz de las explicaciones en español: rioplatense (se baja solo si se pide).
export const SPANISH_VOICE: Voice = { id: 'es_AR-daniela-high', engine: 'piper', label: 'Daniela', gender: 'mujer', accent: 'Argentina' }

// De dónde se bajan: las versiones «tts-models» de sherpa-onnx traen el modelo y su fonetizador.
export const VOICE_RELEASES = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models'
export const SUPERTONIC_ARCHIVE = 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'

export function voiceArchive(voice: Pick<Voice, 'id' | 'engine'>): string {
  return voice.engine === 'supertonic' ? SUPERTONIC_ARCHIVE : `vits-piper-${voice.id}`
}

// Lo que pesa la descarga, aproximado, para avisarlo antes de bajar.
export function voiceSizeMb(voice: Pick<Voice, 'id' | 'engine'>): number {
  if (voice.engine === 'supertonic') return 129
  return voice.id.endsWith('-high') && !/(dii|miro)-high$/.test(voice.id) ? 110 : 64
}

export interface VoiceStatus {
  voice: Voice
  installed: boolean
  // 0 a 1 mientras se baja; null si no se está bajando.
  progress: number | null
  error: string | null
}

// Quién habla: la voz principal del idioma o la segunda (el otro personaje de un diálogo).
export type VoiceRole = 'main' | 'other'
