// El motor de Claude contra Claude Code de verdad (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.
// Mide una corrección en frío, otra reusando la sesión abierta y una con la sesión precalentada.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { shutdownClaude } from '../../src/main/claude/bridge'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { gradeOpenAnswer, prewarmGrading } from '../../src/main/practice/ai-grading'

describe.skipIf(!process.env.LIVE_CLAUDE)('motor de Claude en vivo', () => {
  it('reusa la sesión de corrección y responde más rápido', async () => {
    const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'), 'en')
    const topic = curriculum.find((t) => t.level === 'A2')!
    const subtopic = topic.subtopics[0]
    const exercise = {
      type: 'translation' as const,
      instruction: 'Traducí al inglés.',
      spanish: 'Ayer fui al supermercado con mi hermana y compramos muchas frutas.',
      answers: ['Yesterday I went to the supermarket with my sister and we bought a lot of fruit.'],
      explanation: 'Pasado simple con verbos irregulares.'
    }
    const grade = async (answer: string): Promise<number> => {
      const started = Date.now()
      const feedback = await gradeOpenAnswer({ topic, subtopic, exercise, answers: [answer] })
      expect(typeof feedback.correct).toBe('boolean')
      return Date.now() - started
    }
    const cold = await grade('Yesterday I go to the supermarket with my sister and we buyed many fruits.')
    const warm = await grade('Yesterday I went to supermarket with my sister and we bought much fruits.')
    // Sesión de otro idioma precalentada mientras «el alumno lee la consigna».
    const pt = loadCurriculum(join(__dirname, '..', '..', 'content'), 'pt')
    prewarmGrading('pt')
    await new Promise((resolve) => setTimeout(resolve, 12_000))
    const ptTopic = pt[0]
    const started = Date.now()
    await gradeOpenAnswer({
      topic: ptTopic,
      subtopic: ptTopic.subtopics[0],
      exercise: { ...exercise, instruction: 'Traducí al portugués.', answers: ['Eu sou professora.'], spanish: 'Soy docente.' },
      answers: ['Eu sou professor.']
    })
    const prewarmed = Date.now() - started
    shutdownClaude()
    const lines = [`en frío: ${cold} ms`, `sesión reusada: ${warm} ms`, `sesión precalentada: ${prewarmed} ms`]
    writeFileSync(join(__dirname, 'engine.txt'), lines.join('\n'))
    expect(warm).toBeLessThan(cold)
  }, 300_000)
})
