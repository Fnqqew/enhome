import { describe, expect, it } from 'vitest'
import { detectLang, splitForSpeech } from '../src/shared/speech'

describe('lectura en voz alta de los idiomas nuevos', () => {
  it('reconoce portugués frente al español', () => {
    expect(detectLang('Eu não sou estudante, você é?', 'pt')).toBe('pt')
    expect(detectLang('Yo no soy estudiante, ¿vos sí?', 'pt')).toBe('es')
  })

  it('reconoce italiano frente al español', () => {
    expect(detectLang('Io sono molto stanco oggi', 'it')).toBe('it')
    expect(detectLang('Estoy muy cansado hoy', 'it')).toBe('es')
  })

  it('reconoce francés frente al español', () => {
    expect(detectLang("Je suis très content, c'est parfait", 'fr')).toBe('fr')
    expect(detectLang('Estoy muy contento, es perfecto', 'fr')).toBe('es')
  })

  it('separa una explicación en español de un ejemplo en francés', () => {
    const segments = splitForSpeech('El verbo être es irregular: *Je suis fatigué.*', 'fr')
    expect(segments.map((s) => s.lang)).toEqual(['es', 'fr'])
  })
})