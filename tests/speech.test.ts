import { describe, expect, it } from 'vitest'
import { detectLang, pickVoice, splitForSpeech } from '../src/shared/speech'

describe('detectLang', () => {
  it('distingue español de inglés', () => {
    expect(detectLang('Se usa para hablar de rutinas y hábitos')).toBe('es')
    expect(detectLang("She doesn't like coffee")).toBe('en')
    expect(detectLang('I am from Rosario')).toBe('en')
    expect(detectLang('¿Sos argentino?')).toBe('es')
  })
})

describe('splitForSpeech', () => {
  it('separa ejemplos en inglés de su traducción', () => {
    expect(splitForSpeech("*I'm a student.* → Soy estudiante.")).toEqual([
      { text: "I'm a student.", lang: 'en' },
      { text: 'Soy estudiante.', lang: 'es' }
    ])
  })

  it('une partes seguidas del mismo idioma y descarta símbolos sueltos', () => {
    const segments = splitForSpeech('## Día 1\n\nLa forma es simple. Se agrega -s.\n\n| --- | --- |')
    expect(segments).toHaveLength(1)
    expect(segments[0].lang).toBe('es')
    expect(segments[0].text).toContain('Se agrega')
  })

  it('lee ejemplos entre paréntesis con su idioma', () => {
    const langs = splitForSpeech('Ejemplo (They are here) para practicar.').map((s) => s.lang)
    expect(langs).toEqual(['es', 'en', 'es'])
  })
})

describe('pickVoice', () => {
  const voices = [{ lang: 'en-GB' }, { lang: 'es-ES' }, { lang: 'es-MX' }, { lang: 'en-US' }]

  it('prefiere español latinoamericano e inglés estadounidense', () => {
    expect(pickVoice(voices, 'es')?.lang).toBe('es-MX')
    expect(pickVoice(voices, 'en')?.lang).toBe('en-US')
  })

  it('usa cualquier variante disponible o nada', () => {
    expect(pickVoice([{ lang: 'es-CL' }], 'es')?.lang).toBe('es-CL')
    expect(pickVoice([{ lang: 'fr-FR' }], 'en')).toBeNull()
  })
})
