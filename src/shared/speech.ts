// Preparación de textos para leer en voz alta: separa las partes en español y en inglés
// para leer cada una con la voz correcta.

export type SpeechLang = 'es' | 'en'

export interface SpeechSegment {
  text: string
  lang: SpeechLang
}

const SPANISH_HINTS =
  /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|y|en|es|son|con|para|por|un|una|se|lo|como|más|pero|si|cuando|está|están|hay|tenés|sos|vos|muy|también|porque)\b/gi
const ENGLISH_HINTS =
  /\b(the|is|are|am|was|were|you|he|she|we|they|i|and|to|of|my|your|do|does|did|have|has|will|can|this|that|it's|i'm|don't|doesn't|not|with|from|at|in|on)\b/gi

export function detectLang(text: string): SpeechLang {
  const spanish = text.match(SPANISH_HINTS)?.length ?? 0
  const english = text.match(ENGLISH_HINTS)?.length ?? 0
  return english > spanish ? 'en' : 'es'
}

// Corta por líneas, oraciones y separadores típicos de los resúmenes (→, —, =, paréntesis, comillas)
// y une los trozos seguidos del mismo idioma.
export function splitForSpeech(text: string): SpeechSegment[] {
  const pieces = text
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+[→—–=]\s+|(?<=[.!?])\s+|[()«»"“”\t|]/))
    .map((piece) => piece.replace(/[*_#>`]/g, '').trim())
    .filter((piece) => /\p{L}/u.test(piece))

  const segments: SpeechSegment[] = []
  for (const piece of pieces) {
    const lang = detectLang(piece)
    const last = segments[segments.length - 1]
    if (last && last.lang === lang) last.text = `${last.text}. ${piece}`
    else segments.push({ text: piece, lang })
  }
  return segments
}

const PREFERRED_VOICES: Record<SpeechLang, string[]> = {
  es: ['es-ar', 'es-419', 'es-us', 'es-mx', 'es-es'],
  en: ['en-us', 'en-gb']
}

export function pickVoice<T extends { lang: string }>(voices: T[], lang: SpeechLang): T | null {
  const normalized = (v: T): string => v.lang.toLowerCase().replace('_', '-')
  for (const code of PREFERRED_VOICES[lang]) {
    const voice = voices.find((v) => normalized(v) === code)
    if (voice) return voice
  }
  return voices.find((v) => normalized(v).startsWith(lang)) ?? null
}
