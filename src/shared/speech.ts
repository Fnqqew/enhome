// Preparación de textos para leer en voz alta: separa las partes en español y en inglés
// (incluidas palabras sueltas marcadas en negrita, cursiva, comillas o tablas) para leer cada una con su voz.

export type SpeechLang = 'es' | 'en'

export interface SpeechSegment {
  text: string
  lang: SpeechLang
}

const words = (list: string): Set<string> => new Set(list.split(/\s+/).filter(Boolean))

const ENGLISH_WORDS = words(`
  the is are am was were be been being you he she it we they i him her us them my your his its our their
  and or but so because to of in on at for with from by about this that these those there here
  do does did done don't doesn't didn't have has had haven't hasn't will won't would can can't could should must might may not
  what where when who why how which yes hello hi please thanks thank very really good bad happy tired late old years
  i'm you're he's she's it's we're they're isn't aren't wasn't weren't i've i'll let's
  go goes went gone come came see saw make made get got take took eat ate like likes live lives work works study play plays
  always usually often sometimes never every today tomorrow yesterday now just already yet ever since ago next last
  name friend sister brother mother father teacher student home morning night book car dog cat
`)

const SPANISH_WORDS = words(`
  el la los las un una unos unas de del al a y e o u pero que en es son está están era fue ser estar con para por
  se lo le les te nos mi tu su sus como más menos muy también porque cuando si sí no hay tiene tenés sos vos yo él ella ellos
  nosotros usted ustedes este esta estos estas ese esa eso acá ahí todo toda todos siempre nunca hoy mañana ayer ya todavía
  sujeto verbo oración pregunta respuesta ejemplo ejemplos forma regla afirmativo negativo presente pasado futuro usa usar día
  soy eres somos estoy estás estamos tengo tenemos tienen vivo vive trabajo trabaja hablo habla llamo llama año años
  estudiante docente casa perro gato hermano hermana mamá papá amigo amiga escuela ciudad país ahora bien mal gracias hola chau
  qué cómo dónde cuándo quién
`)

// Puntaje por palabra: las palabras conocidas valen 1; las pistas por la forma de la palabra, menos.
// null cuando no hay pistas suficientes.
export function detectLang(text: string): SpeechLang | null {
  const tokens = text.toLowerCase().replace(/’/g, "'").match(/[\p{L}']+/gu) ?? []
  let english = 0
  let spanish = 0
  for (const token of tokens) {
    const inEnglish = ENGLISH_WORDS.has(token)
    const inSpanish = SPANISH_WORDS.has(token)
    if (inEnglish && !inSpanish) english++
    else if (inSpanish && !inEnglish) spanish++
    else if (!inEnglish && !inSpanish) {
      if (/[áéíóúñü]/.test(token)) spanish++
      else if (/[a-z]'[a-z]/.test(token)) english++
      else if (/(ción|sión|mente|dad|ando|iendo)$/.test(token)) spanish++
      else if (token.length > 4 && /(ing|tion|ly)$/.test(token)) english++
      else if (/th|wh|sh|ck|ee|oo|ou|w|k/.test(token)) english += 0.5
      else if (token.length >= 4 && /[ao]s?$/.test(token)) spanish += 0.5
    }
  }
  if (english > spanish) return 'en'
  if (spanish > english) return 'es'
  return null
}

// Separadores "fuertes" (pausa): líneas, fin de oración y celdas de tabla.
// Separadores "suaves" (sin pausa): negrita, cursiva, comillas, paréntesis y flechas.
export function splitForSpeech(text: string): SpeechSegment[] {
  const strong = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(#{1,6}|[-*+]|\d+\.|>)\s+/, ''))
    .flatMap((line) => line.split(/(?<=[.!?])\s+|\s*\|\s*/))

  const segments: SpeechSegment[] = []
  for (const piece of strong) {
    let firstInPiece = true
    for (const raw of piece.split(/\*\*|\*|__|`|«|»|"|“|”|\(|\)|\s[→—–=]\s/)) {
      const part = raw.replace(/[_#>]/g, '').replace(/\s+/g, ' ').trim()
      if (!/\p{L}/u.test(part)) continue

      const last = segments[segments.length - 1]
      const lang = detectLang(part) ?? last?.lang ?? 'es'
      if (last && last.lang === lang) {
        const joiner = /[.!?,;:]$/.test(last.text) || !firstInPiece ? ' ' : '. '
        last.text = `${last.text}${joiner}${part}`
      } else {
        segments.push({ text: part, lang })
      }
      firstInPiece = false
    }
  }
  return segments
}

const PREFERRED_VOICES: Record<SpeechLang, string[]> = {
  es: ['es-ar', 'es-419', 'es-us', 'es-mx', 'es-es'],
  en: ['en-us', 'en-gb']
}

const langOf = (voice: { lang: string }): string => voice.lang.toLowerCase().replace('_', '-')

// Voz elegida por el alumno si existe; si no, la mejor disponible para el idioma.
export function pickVoice<T extends { lang: string; name?: string }>(voices: T[], lang: SpeechLang, preferredName?: string | null): T | null {
  if (preferredName) {
    const chosen = voices.find((v) => v.name === preferredName)
    if (chosen) return chosen
  }
  for (const code of PREFERRED_VOICES[lang]) {
    const voice = voices.find((v) => langOf(v) === code)
    if (voice) return voice
  }
  return voices.find((v) => langOf(v).startsWith(lang)) ?? null
}

export function hasVoiceFor(voices: { lang: string }[], lang: SpeechLang): boolean {
  return voices.some((v) => langOf(v).startsWith(lang))
}
