// Prueba real contra Claude Code (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { generatePlacementQuestions } from '../../src/main/engine/placement-questions'

describe.skipIf(!process.env.LIVE_CLAUDE)('Claude en vivo', () => {
  it('genera 3 preguntas válidas de nivelación', async () => {
    const topic = loadCurriculum(join(__dirname, '..', '..', 'content'))[0]
    const questions = await generatePlacementQuestions(topic)
    console.log(JSON.stringify(questions, null, 2))
    expect(questions).toHaveLength(3)
    for (const q of questions) {
      expect(q.options).toHaveLength(4)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(topic.subtopics.map((s) => s.id)).toContain(q.subtopicId)
    }
  }, 180_000)
})
