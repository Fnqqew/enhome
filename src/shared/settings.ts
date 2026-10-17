// Preferencias de personalización, compartidas entre el proceso principal y la interfaz.

import { z } from 'zod'
import { EXERCISE_TYPES } from './exercises'
import { LANGUAGE_IDS, type LanguageId } from './languages'
import { SUMMARY_TYPE_IDS } from './summaries'

// Los colores con los que se dibuja la vista previa de un estilo y el fondo de la ventana al abrir.
// Tienen que coincidir con styles.css: un test lo verifica.
export interface StylePreview {
  bg: string
  sidebar: string
  surface: string
  accent: string
  text: string
  border: string
}

// Estilos visuales completos: cada uno trae su logo, colores, tipografías y formas.
export const STYLES: readonly {
  id: 'celeste' | 'ruta' | 'cuaderno' | 'racha' | 'noche' | 'papel' | 'contraste' | 'original'
  label: string
  description: string
  colors: readonly string[]
  preview: { light: StylePreview; dark: StylePreview }
}[] = [
  {
    id: 'celeste',
    label: 'Celeste',
    description: 'Sobrio y plano, con un guiño argentino.',
    colors: ['#4ba3e3', '#0b3c6d', '#f2b33d'],
    preview: {
      light: { bg: '#f5f8fb', sidebar: '#ffffff', surface: '#ffffff', accent: '#1c6fb3', text: '#0b1f33', border: '#d5e2ee' },
      dark: { bg: '#0d1620', sidebar: '#13202d', surface: '#13202d', accent: '#6cb8ef', text: '#e6eef6', border: '#22364a' }
    }
  },
  {
    id: 'ruta',
    label: 'Ruta',
    description: 'El recorrido como una línea de subte.',
    colors: ['#0f1b33', '#1e9e6a', '#e8772e'],
    preview: {
      light: { bg: '#eef1f6', sidebar: '#0f1b33', surface: '#ffffff', accent: '#167d53', text: '#0f1b33', border: '#d7dce6' },
      dark: { bg: '#0b1220', sidebar: '#070c17', surface: '#121b2e', accent: '#3fcf8e', text: '#e8ecf4', border: '#243152' }
    }
  },
  {
    id: 'cuaderno',
    label: 'Cuaderno',
    description: 'Hoja rayada, birome azul y resaltador.',
    colors: ['#2446b8', '#e0524b', '#ffe45c'],
    preview: {
      light: { bg: '#fbfbf8', sidebar: '#f4f6fa', surface: '#ffffff', accent: '#2446b8', text: '#1e2230', border: '#dce3ee' },
      dark: { bg: '#151923', sidebar: '#11141c', surface: '#1c2130', accent: '#8da6ff', text: '#e9ebf2', border: '#2c3346' }
    }
  },
  {
    id: 'racha',
    label: 'Racha',
    description: 'Táctil y con energía, para la constancia.',
    colors: ['#ff6b4a', '#ffc53d', '#2e2e2e'],
    preview: {
      light: { bg: '#f5f4f2', sidebar: '#ecebe8', surface: '#ffffff', accent: '#cf4424', text: '#232323', border: '#2e2e2e' },
      dark: { bg: '#161616', sidebar: '#111111', surface: '#1f1f1f', accent: '#ff7a5a', text: '#eeeeee', border: '#000000' }
    }
  },
  {
    id: 'noche',
    label: 'Noche',
    description: 'Negro puro para pantallas OLED y para estudiar de noche.',
    colors: ['#000000', '#9d8cff', '#ededed'],
    preview: {
      light: { bg: '#f4f4f6', sidebar: '#ffffff', surface: '#ffffff', accent: '#5b3fd0', text: '#16161c', border: '#dedee6' },
      dark: { bg: '#000000', sidebar: '#000000', surface: '#0b0b0d', accent: '#9d8cff', text: '#ececf1', border: '#1f1f26' }
    }
  },
  {
    id: 'papel',
    label: 'Papel',
    description: 'Sepia y letra de libro, para leer mucho sin cansarte.',
    colors: ['#f4ecd8', '#8a4b1f', '#3b2f20'],
    preview: {
      light: { bg: '#f4ecd8', sidebar: '#efe5cc', surface: '#fbf6ea', accent: '#8a4b1f', text: '#3b2f20', border: '#dccfae' },
      dark: { bg: '#1e1912', sidebar: '#191510', surface: '#27211a', accent: '#e0a46a', text: '#eadfc8', border: '#3d3427' }
    }
  },
  {
    id: 'contraste',
    label: 'Alto contraste',
    description: 'Blanco y negro, bordes marcados y letra muy legible.',
    colors: ['#000000', '#ffffff', '#ffd400'],
    preview: {
      light: { bg: '#ffffff', sidebar: '#ffffff', surface: '#ffffff', accent: '#0037c9', text: '#000000', border: '#000000' },
      dark: { bg: '#000000', sidebar: '#000000', surface: '#000000', accent: '#ffd400', text: '#ffffff', border: '#ffffff' }
    }
  },
  {
    id: 'original',
    label: 'Original',
    description: 'El diseño con el que nació la app.',
    colors: ['#3f5bd0', '#f6f5f2', '#22211f'],
    preview: {
      light: { bg: '#f6f5f2', sidebar: '#ffffff', surface: '#ffffff', accent: '#3f5bd0', text: '#22211f', border: '#e4e2dc' },
      dark: { bg: '#161719', sidebar: '#1f2023', surface: '#1f2023', accent: '#3f5bd0', text: '#ecebe8', border: '#2e3034' }
    }
  }
]

export type StyleId = (typeof STYLES)[number]['id']

// «estilo» usa el color propio del estilo elegido; el resto lo reemplaza.
export const PALETTES = [
  { id: 'estilo', label: 'Del estilo', light: '', dark: '' },
  { id: 'azul', label: 'Azul', light: '#3f5bd0', dark: '#8aa0f0' },
  { id: 'salvia', label: 'Salvia', light: '#3d7a5c', dark: '#7fc4a0' },
  { id: 'terracota', label: 'Terracota', light: '#b4532f', dark: '#eb9573' },
  { id: 'violeta', label: 'Violeta', light: '#7048c8', dark: '#b39af0' },
  { id: 'turquesa', label: 'Turquesa', light: '#1f7a86', dark: '#6cc6d1' },
  { id: 'rosa', label: 'Rosa', light: '#b83e6e', dark: '#ee8db3' },
  { id: 'ambar', label: 'Ámbar', light: '#9a6208', dark: '#e8b45c' },
  { id: 'grafito', label: 'Grafito', light: '#4a4d55', dark: '#b8bcc6' }
] as const

export const FONTS = [
  { id: 'estilo', label: 'Del estilo' },
  { id: 'moderna', label: 'Moderna' },
  { id: 'clasica', label: 'Clásica' },
  { id: 'amigable', label: 'Amigable' }
] as const

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  style: z.enum(STYLES.map((s) => s.id) as [StyleId, ...StyleId[]]),
  palette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]),
  font: z.enum(FONTS.map((f) => f.id) as [string, ...string[]]),
  fontSize: z.enum(['sm', 'md', 'lg']),
  density: z.enum(['compact', 'comfortable']),
  favoriteSummaryTypes: z.array(z.enum(SUMMARY_TYPE_IDS)).max(SUMMARY_TYPE_IDS.length),
  // El curso que se está viendo: cada idioma tiene su propio progreso.
  language: z.enum(LANGUAGE_IDS),
  // Nombre de la voz del sistema elegida para cada idioma; null = automática.
  voiceEs: z.string().max(200).nullable(),
  voiceEn: z.string().max(200).nullable(),
  voicePt: z.string().max(200).nullable(),
  voiceIt: z.string().max(200).nullable(),
  voiceFr: z.string().max(200).nullable(),
  reduceMotion: z.boolean(),
  // Pantalla de carga al abrir: completa (la animación entera), breve o ninguna.
  splash: z.enum(['full', 'short', 'none']),
  // Cuántos ejercicios tiene la práctica del día.
  practiceLength: z.enum(['short', 'normal', 'intense']),
  // Formatos que el alumno sacó de sus prácticas.
  excludedTypes: z.array(z.enum(EXERCISE_TYPES)).max(EXERCISE_TYPES.length - 4),
  // Para los certificados (opcional).
  studentName: z.string().max(60),
  // Sonidos de acierto, error y logro (apagados por defecto).
  sounds: z.boolean()
})

export const PRACTICE_LENGTHS = {
  short: { label: 'Corta', size: 5 },
  normal: { label: 'Normal', size: 8 },
  intense: { label: 'Intensa', size: 10 }
} as const

// Qué ajuste guarda la voz de cada idioma.
export const VOICE_SETTING = {
  es: 'voiceEs',
  en: 'voiceEn',
  pt: 'voicePt',
  it: 'voiceIt',
  fr: 'voiceFr'
} as const satisfies Record<'es' | LanguageId, keyof z.infer<typeof settingsSchema>>

export type AppSettings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  style: 'celeste',
  palette: 'estilo',
  font: 'estilo',
  fontSize: 'md',
  density: 'comfortable',
  favoriteSummaryTypes: [],
  language: 'en',
  voiceEs: null,
  voiceEn: null,
  voicePt: null,
  voiceIt: null,
  voiceFr: null,
  reduceMotion: false,
  splash: 'full',
  practiceLength: 'normal',
  excludedTypes: [],
  studentName: '',
  sounds: false
}
