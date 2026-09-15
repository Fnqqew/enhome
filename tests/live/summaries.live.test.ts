// Prueba real contra Claude Code (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { answerAboutText, generateSummary } from '../../src/main/summaries/generation'

const topic = loadCurriculum(join(__dirname, '..', '..', 'content')).find((t) => t.id === 'a1-to-be')!

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now()
  const result = await fn()
  console.log(`${label}: ${Math.round((Date.now() - started) / 1000)} s`)
  return result
}

describe.skipIf(!process.env.LIVE_CLAUDE)('resúmenes con Claude en vivo', () => {
  it('genera y revisa un resumen de errores comunes', async () => {
    const content = await timed('errores comunes', () => generateSummary(topic, 'errores'))
    if (content.format !== 'markdown') throw new Error('se esperaba Markdown')
    console.log(content.markdown)
    expect(content.markdown.length).toBeGreaterThan(300)
  }, 600_000)

  it('genera y revisa tarjetas de repaso', async () => {
    const content = await timed('tarjetas', () => generateSummary(topic, 'tarjetas'))
    if (content.format !== 'cards') throw new Error('se esperaban tarjetas')
    console.log(JSON.stringify(content.cards, null, 2))
    expect(content.cards.length).toBeGreaterThanOrEqual(8)
  }, 600_000)

  it('responde una duda sobre un fragmento', async () => {
    const answer = await timed('pregunta', () =>
      answerAboutText({ topic, fragment: 'No existe amn\'t: con I siempre se dice I\'m not.', question: '¿Y en las preguntas negativas cómo se dice?' })
    )
    console.log(answer)
    expect(answer.length).toBeGreaterThan(20)
  }, 300_000)
})
