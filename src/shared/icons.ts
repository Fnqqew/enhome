// Nombres de los íconos de línea propios. Están acá (y no en la interfaz) porque los logros,
// los comodines y los tipos de comentario, que se definen fuera de la interfaz, eligen el suyo.

import type { SectionId } from './sections'

export const GLYPHS = [
  'bulb',
  'retry',
  'shield',
  'play',
  'pause',
  'stop',
  'star',
  'check',
  'cross',
  'bug',
  'flame',
  'chat',
  'compass',
  'pencil',
  'cap',
  'medal',
  'trend',
  'book',
  'landmark',
  'target',
  'flask',
  'page',
  'trophy',
  'heart',
  'calendar',
  'clock',
  'sparkle',
  'mic'
] as const

export type Glyph = (typeof GLYPHS)[number]
export type IconName = SectionId | Glyph
