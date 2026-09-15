// Prueba real contra Claude Code (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { generateExam } from '../../src/main/exams/generation'
import { planWeeklyExam } from '../../src/main/exams/plan'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = (id: string) => curriculum.find((t) => t.id === id)!

describe.skipIf(!process.env.LIVE_CLAUDE)('examen con Claude en vivo', () => {
  it('genera y revisa un examen semanal de 20 preguntas', async () => {
    const nouns = topic('a1-nouns-articles')
    const plan = planWeeklyExam(nouns, [topic('a1-to-be')])
    const items = plan.map((p) => {
      const t = topic(p.topicId)
      return { topic: t, subtopic: t.subtopics.find((s) => s.id === p.subtopicId)!, type: p.type }
    })

    const started = Date.now()
    const questions = await generateExam({ kind: 'weekly', level: 'A1', items, focusNotes: [] })
    console.log(`${questions.length} preguntas en ${Math.round((Date.now() - started) / 1000)} s`)
    console.log(JSON.stringify(questions, null, 2))
    expect(questions.length).toBeGreaterThanOrEqual(18)
  }, 900_000)
})
