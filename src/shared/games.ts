// Juegos para practicar sin esperar a Claude: usan los ejemplos y los errores típicos del temario ya
// visto, más el vocabulario guardado.

import type { Glyph } from './icons'

export const GAME_IDS = ['contrarreloj', 'escucha', 'desordenadas', 'memotest', 'ahorcado', 'verdadero', 'dictado', 'pronunciacion'] as const
export type GameId = (typeof GAME_IDS)[number]

export interface GameInfo {
  title: string
  description: string
  icon: Glyph
  // Necesita la voz del idioma del curso.
  needsVoice: boolean
  // Puntos de juego por cada punto de experiencia.
  pointsPerXp: number
}

export const GAMES: Record<GameId, GameInfo> = {
  contrarreloj: {
    title: 'Contrarreloj',
    description: 'Un minuto para traducir todas las frases que puedas. Cada error te cuesta 3 segundos.',
    icon: 'clock',
    needsVoice: false,
    pointsPerXp: 2
  },
  escucha: {
    title: 'Escuchá y elegí',
    description: 'Suena una frase en el idioma del curso: elegí qué significa.',
    icon: 'play',
    needsVoice: true,
    pointsPerXp: 7
  },
  desordenadas: {
    title: 'Frases desordenadas',
    description: 'Ordená las palabras para armar la frase correcta.',
    icon: 'pencil',
    needsVoice: false,
    pointsPerXp: 7
  },
  memotest: {
    title: 'Memotest',
    description: 'Encontrá los pares: cada frase con su traducción, en la menor cantidad de jugadas.',
    icon: 'sparkle',
    needsVoice: false,
    pointsPerXp: 7
  },
  ahorcado: {
    title: 'Ahorcado',
    description: 'Adiviná la palabra que falta en la frase, letra por letra, antes de quedarte sin vidas.',
    icon: 'target',
    needsVoice: false,
    pointsPerXp: 7
  },
  verdadero: {
    title: '¿Está bien?',
    description: 'Frases con y sin los errores típicos de los hispanohablantes: decidí cuáles están bien.',
    icon: 'check',
    needsVoice: false,
    pointsPerXp: 7
  },
  dictado: {
    title: 'Dictado',
    description: 'Escuchá la frase y escribila tal cual. Entrena el oído y la ortografía.',
    icon: 'chat',
    needsVoice: true,
    pointsPerXp: 7
  },
  pronunciacion: {
    title: 'Pronunciación',
    description: 'Decí la frase en voz alta y un reconocimiento de voz que corre en tu computadora te dice qué entendió. Experimental.',
    icon: 'mic',
    needsVoice: false,
    pointsPerXp: 7
  }
}

// Las primeras partidas de cada día dan experiencia; después se puede seguir jugando por el récord.
export const GAMES_WITH_XP_PER_DAY = 6
export const MAX_GAME_XP = 15

export function gameXp(game: GameId, score: number): number {
  return Math.max(1, Math.min(MAX_GAME_XP, Math.round(score / GAMES[game].pointsPerXp)))
}

export interface GamePhrase {
  target: string
  es: string
  topicTitle: string
}

export interface GameMistake {
  wrong: string
  right: string
  why: string
}

export interface GameWord {
  term: string
  translation: string
}

export interface GameRecord {
  best: number
  plays: number
  playedToday: number
}

export interface GameDeck {
  phrases: GamePhrase[]
  mistakes: GameMistake[]
  words: GameWord[]
  records: Record<GameId, GameRecord>
  // Partidas que todavía dan experiencia hoy.
  xpGamesLeft: number
}

export interface GameResult {
  score: number
  best: number
  record: boolean
  xp: number
}
