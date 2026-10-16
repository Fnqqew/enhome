// Idiomas que se pueden estudiar. Cada uno es un curso independiente, con su temario
// (content/<id>/), su base de datos y su progreso. Las explicaciones siempre van en español.

export const LANGUAGE_IDS = ['en', 'pt', 'it', 'fr'] as const

export type LanguageId = (typeof LANGUAGE_IDS)[number]

export interface LanguageInfo {
  id: LanguageId
  // Como se nombra en una oración: «ejemplos en inglés».
  name: string
  // Como se muestra solo: «Inglés».
  label: string
  // Como lo llaman sus hablantes.
  endonym: string
  code: string
  // Cómo se lo nombra en los pedidos a Claude (con la variante cuando importa).
  promptName: string
  // Voces del sistema preferidas, en orden.
  voices: readonly string[]
  // Para la lectura en voz alta cuando no hay una voz instalada.
  speechTag: string
  // Lo que se escribe en la pantalla de carga después de «Hola».
  greeting: string
  // Color propio del curso, para el selector de idioma.
  color: string
}

export const LANGUAGES: readonly LanguageInfo[] = [
  {
    id: 'en',
    name: 'inglés',
    label: 'Inglés',
    endonym: 'English',
    code: 'EN',
    promptName: 'inglés',
    voices: ['en-us', 'en-gb'],
    speechTag: 'en-US',
    greeting: 'Hello',
    color: '#1c6fb3'
  },
  {
    id: 'pt',
    name: 'portugués',
    label: 'Portugués',
    endonym: 'Português',
    code: 'PT',
    promptName: 'portugués de Brasil',
    voices: ['pt-br', 'pt-pt'],
    speechTag: 'pt-BR',
    greeting: 'Olá',
    color: '#1e9e6a'
  },
  {
    id: 'it',
    name: 'italiano',
    label: 'Italiano',
    endonym: 'Italiano',
    code: 'IT',
    promptName: 'italiano',
    voices: ['it-it'],
    speechTag: 'it-IT',
    greeting: 'Ciao',
    color: '#c8463d'
  },
  {
    id: 'fr',
    name: 'francés',
    label: 'Francés',
    endonym: 'Français',
    code: 'FR',
    promptName: 'francés',
    voices: ['fr-fr', 'fr-ca'],
    speechTag: 'fr-FR',
    greeting: 'Bonjour',
    color: '#4a5fd1'
  }
]

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
