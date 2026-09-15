import { describe, expect, it } from 'vitest'
import { detectLang, hasVoiceFor, pickVoice, splitForSpeech } from '../src/shared/speech'

const langs = (text: string): string[] => splitForSpeech(text).map((s) => s.lang)

describe('detectLang', () => {
  it('distingue español de inglés', () => {
    expect(detectLang('Se usa para hablar de rutinas y hábitos')).toBe('es')
    expect(detectLang("She doesn't like coffee")).toBe('en')
    expect(detectLang('I am from Rosario')).toBe('en')
    expect(detectLang('¿Sos argentino?')).toBe('es')
    expect(detectLang('My name is Lucía')).toBe('en')
  })

  it('reconoce palabras sueltas', () => {
    expect(detectLang('he')).toBe('en')
    expect(detectLang('is')).toBe('en')
    expect(detectLang('se usa')).toBe('es')
  })

  it('usa la forma de las palabras cuando no las conoce', () => {
    expect(detectLang('Soy estudiante')).toBe('es')
    expect(detectLang('coffee')).toBe('en')
    expect(detectLang('Rosario')).toBe('es')
  })

  it('devuelve null si no hay pistas', () => {
    expect(detectLang('Hmm')).toBeNull()
    expect(detectLang('25')).toBeNull()
  })
})

describe('splitForSpeech', () => {
  it('separa ejemplos en inglés de su traducción', () => {
    expect(splitForSpeech("*I'm a student.* → Soy estudiante.")).toEqual([
      { text: "I'm a student.", lang: 'en' },
      { text: 'Soy estudiante.', lang: 'es' }
    ])
  })

  it('lee con voz en inglés las palabras marcadas dentro de una frase en español', () => {
    expect(langs('Con **he**, **she** e **it** se usa **is**.')).toEqual(['es', 'en', 'es', 'en', 'es', 'en'])
  })

  it('separa las celdas de las tablas', () => {
    expect(splitForSpeech('| I | yo |')).toEqual([
      { text: 'I', lang: 'en' },
      { text: 'yo', lang: 'es' }
    ])
  })

  it('quita marcas de títulos y listas, y une partes del mismo idioma', () => {
    const segments = splitForSpeech('## Día 1 — Pronombres personales\n\n- La forma es simple. Se agrega -s.')
    expect(segments).toHaveLength(1)
    expect(segments[0].lang).toBe('es')
    expect(segments[0].text).not.toContain('#')
    expect(segments[0].text).toContain('Se agrega')
  })

  it('lo que no tiene pistas se lee con la voz de lo anterior', () => {
    expect(langs('I am happy. Hmm.')).toEqual(['en'])
  })

  it('lee ejemplos entre paréntesis con su idioma', () => {
    expect(langs('Ejemplo para practicar (They are here) en clase.')).toEqual(['es', 'en', 'es'])
  })
})

describe('pickVoice', () => {
  const voices = [
    { lang: 'en-GB', name: 'Hazel' },
    { lang: 'es-ES', name: 'Helena' },
    { lang: 'es-MX', name: 'Sabina' },
    { lang: 'en-US', name: 'Zira' },
    { lang: 'en-US', name: 'David' }
  ]

  it('prefiere español latinoamericano e inglés estadounidense', () => {
    expect(pickVoice(voices, 'es')?.name).toBe('Sabina')
    expect(pickVoice(voices, 'en')?.name).toBe('Zira')
  })

  it('respeta la voz elegida si existe', () => {
    expect(pickVoice(voices, 'en', 'David')?.name).toBe('David')
    expect(pickVoice(voices, 'es', 'No existe')?.name).toBe('Sabina')
  })

  it('usa cualquier variante disponible o nada', () => {
    expect(pickVoice([{ lang: 'es-CL' }], 'es')?.lang).toBe('es-CL')
    expect(pickVoice([{ lang: 'en-US' }], 'es')).toBeNull()
    expect(hasVoiceFor([{ lang: 'en-US' }], 'es')).toBe(false)
  })
})
