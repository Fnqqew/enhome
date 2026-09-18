// Preferencias de personalización, compartidas entre el proceso principal y la interfaz.

import { z } from 'zod'
import { SUMMARY_TYPE_IDS } from './summaries'

// Estilos visuales completos: cada uno trae su logo, colores, tipografías y formas.
// «window» es el color de la barra de la ventana, que el proceso principal pinta antes de abrirla.
export const STYLES = [
  {
    id: 'celeste',
    label: 'Celeste',
    description: 'Sobrio y plano, con un guiño argentino.',
    colors: ['#4ba3e3', '#0b3c6d', '#f2b33d'],
    window: { light: '#ffffff', dark: '#13202d' }
  },
  {
    id: 'ruta',
    label: 'Ruta',
    description: 'El recorrido como una línea de subte.',
    colors: ['#0f1b33', '#1e9e6a', '#e8772e'],
    window: { light: '#0f1b33', dark: '#070c17' }
  },
  {
    id: 'cuaderno',
    label: 'Cuaderno',
    description: 'Hoja rayada, birome azul y resaltador.',
    colors: ['#2446b8', '#e0524b', '#ffe45c'],
    window: { light: '#f4f6fa', dark: '#11141c' }
  },
  {
    id: 'racha',
    label: 'Racha',
    description: 'Táctil y con energía, para la constancia.',
    colors: ['#ff6b4a', '#ffc53d', '#2e2e2e'],
    window: { light: '#ecebe8', dark: '#111111' }
  },
  {
    id: 'original',
    label: 'Original',
    description: 'El diseño con el que nació la app.',
    colors: ['#3f5bd0', '#f6f5f2', '#22211f'],
    window: { light: '#ffffff', dark: '#1f2023' }
  }
] as const

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
  // Nombre de la voz del sistema elegida para cada idioma; null = automática.
  voiceEs: z.string().max(200).nullable(),
  voiceEn: z.string().max(200).nullable(),
  reduceMotion: z.boolean()
})

export type AppSettings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  style: 'celeste',
  palette: 'estilo',
  font: 'estilo',
  fontSize: 'md',
  density: 'comfortable',
  favoriteSummaryTypes: [],
  voiceEs: null,
  voiceEn: null,
  reduceMotion: false
}
