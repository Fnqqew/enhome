// Idiomas que se pueden estudiar. Cada uno es un paquete en content/<id>/ (su ficha idioma.json, el temario,
// el examen inicial, el vocabulario y la pronunciación) con su propia base de datos y su progreso.
// Las explicaciones siempre van en español. Sumar un idioma: su carpeta y una línea acá.

import { z } from 'zod'
import en from '../../content/en/idioma.json'
import fr from '../../content/fr/idioma.json'
import it from '../../content/it/idioma.json'
import pt from '../../content/pt/idioma.json'

export const LANGUAGE_IDS = ['en', 'pt', 'it', 'fr'] as const

export type LanguageId = (typeof LANGUAGE_IDS)[number]

// Cómo se escribe el idioma: los que no usan nuestro alfabeto suman un curso de escritura.
export const SCRIPTS = ['latin', 'cyrillic', 'japanese', 'chinese', 'hangul'] as const
export type Script = (typeof SCRIPTS)[number]

// La ficha de cada idioma vive con su contenido, en content/<id>/idioma.json.
export const languagePackSchema = z.object({
  id: z.enum(LANGUAGE_IDS),
  // Como se nombra en una oración: «ejemplos en inglés».
  name: z.string().min(1),
  // Como se muestra solo: «Inglés».
  label: z.string().min(1),
  // Como lo llaman sus hablantes.
  endonym: z.string().min(1),
  code: z.string().min(2).max(3),
  // Cómo se lo nombra en los pedidos a Claude (con la variante cuando importa).
  promptName: z.string().min(1),
  // Lo que se escribe en la pantalla de carga después de «Hola».
  greeting: z.string().min(1),
  // Color propio del curso, para el selector de idioma.
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  script: z.enum(SCRIPTS),
  // Qué variante se enseña y de cuáles se dan notas.
  variant: z.string().min(1),
  // Para la lectura en voz alta con las voces de Windows.
  speechTag: z.string().min(2),
  systemVoices: z.array(z.string()).min(1)
})

export type LanguagePack = z.infer<typeof languagePackSchema>

export interface LanguageInfo extends LanguagePack {
  // Voces del sistema preferidas, en orden (alias de systemVoices).
  voices: readonly string[]
}

const PACKS: Record<LanguageId, unknown> = { en, pt, it, fr }

export const LANGUAGES: readonly LanguageInfo[] = LANGUAGE_IDS.map((id) => {
  const pack = languagePackSchema.parse(PACKS[id])
  if (pack.id !== id) throw new Error(`content/${id}/idioma.json dice ser «${pack.id}».`)
  return { ...pack, voices: pack.systemVoices }
})

export function languageInfo(id: LanguageId): LanguageInfo {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]
}

// Estado de un curso para el selector de idioma.
export interface CourseSummary {
  language: LanguageId
  // Tiene temario: los cursos sin contenido todavía se muestran como «próximamente».
  available: boolean
  // Hizo el examen inicial (o eligió empezar de cero).
  started: boolean
  paused: boolean
  level: string | null
  topicTitle: string | null
  topics: number
}
