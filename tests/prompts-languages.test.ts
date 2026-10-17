import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../src/main/content/curriculum'
import { buildReviewPrompt } from '../src/main/practice/ai-grading'
import { buildPoolPrompt } from '../src/main/practice/generation'
import { buildSummaryPrompt } from '../src/main/summaries/generation'
import { longSample } from './helpers/long-exercises'

const english = loadCurriculum(join(__dirname, '..', 'content'))[0]
// Un tópico armado sin texto en inglés: así cualquier «inglés» del pedido vendría de la plantilla.
const french = {
  ...english,
  id: 'fr-a1-etre',
  language: 'fr' as const,
  title: 'Être y avoir',
  targetTitle: 'Être et avoir',
  description: 'Los dos verbos básicos.',
  objectives: ['Conjugar être'],
  summary: [1, 2, 3, 4, 5].map((d) => `## Día ${d}\n\nTexto.`).join('\n'),
  subtopics: english.subtopics.map((s) => ({
    ...s,
    title: 'Être',
    goal: 'Conjugar être.',
    keyPoints: ['Je suis, tu es, il est.'],
    examples: [
      { target: 'Je suis content.', es: 'Estoy contento.' },
      { target: 'Tu es là.', es: 'Estás acá.' }
    ],
    commonMistakes: []
  }))
}

describe('pedidos a Claude según el idioma del curso', () => {
  it('la práctica se pide en el idioma del curso', () => {
    const prompt = buildPoolPrompt({ topic: french, subtopic: french.subtopics[0], kind: 'lesson', counts: { translation: 1 }, avoid: [] })
    expect(prompt).toContain('traducir al francés')
    expect(prompt).not.toContain('inglés')
  })

  it('la corrección habla del idioma del curso', () => {
    const prompt = buildReviewPrompt({
      topic: french,
      subtopic: french.subtopics[0],
      exercise: longSample('translation_set', 1),
      answers: ['a', 'b', 'c']
    })
    expect(prompt).toContain('al francés')
    expect(prompt).not.toContain('inglés')
  })

  it('los resúmenes piden ejemplos en el idioma del curso', () => {
    const prompt = buildSummaryPrompt(french, 'dialogo')
    expect(prompt).toContain('diálogo cotidiano en francés')
    expect(prompt).not.toContain('inglés')
  })

  it('el curso de inglés sigue pidiendo inglés', () => {
    const prompt = buildPoolPrompt({ topic: english, subtopic: english.subtopics[0], kind: 'lesson', counts: { translation: 1 }, avoid: [] })
    expect(prompt).toContain('traducir al inglés')
  })
})
