// Preferencias de personalización, compartidas entre el proceso principal y la interfaz.

import { z } from 'zod'

export const PALETTES = [
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
  { id: 'moderna', label: 'Moderna' },
  { id: 'clasica', label: 'Clásica' },
  { id: 'amigable', label: 'Amigable' }
] as const

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  palette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]),
  font: z.enum(FONTS.map((f) => f.id) as [string, ...string[]]),
  fontSize: z.enum(['sm', 'md', 'lg']),
  density: z.enum(['compact', 'comfortable'])
})

export type AppSettings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  palette: 'azul',
  font: 'moderna',
  fontSize: 'md',
  density: 'comfortable'
}
