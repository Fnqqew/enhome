// Prueba real contra Claude Code (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { gradeOpenAnswer } from '../../src/main/practice/ai-grading'
import { planPool } from '../../src/main/practice/composition'
import { generatePracticePool } from '../../src/main/practice/generation'

const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'))
const topic = curriculum.find((t) => t.id === 'a1-to-be')!
const subtopic = topic.subtopics.find((s) => s.id === 'presentarse')!

describe.skipIf(!process.env.LIVE_CLAUDE)('práctica con Claude en vivo', () => {
  it('genera los ejercicios de un día de lectura y escritura', async () => {
    const counts = planPool(subtopic.focus)
    const started = Date.now()
    const exercises = await generatePracticePool({ topic, subtopic, kind: 'lesson', counts, avoid: [] })
    console.log(`${exercises.length} ejercicios en ${Math.round((Date.now() - started) / 1000)} s`)
    console.log(JSON.stringify(exercises, null, 2))
    for (const type of Object.keys(counts)) expect(exercises.some((e) => e.type === type)).toBe(true)
  }, 300_000)

  it('corrige un texto con errores', async () => {
    const exercise = {
      type: 'writing' as const,
      instruction: 'Escribí una presentación.',
      task: 'Presentate: nombre, edad, de dónde sos y a qué te dedicás.',
      minWords: 20,
      maxWords: 50,
      guidance: ['Tu nombre y edad', 'De dónde sos', 'Tu profesión'],
      sampleAnswer: "Hi! My name is Ana. I'm 28 years old and I'm from Córdoba. I'm a nurse."
    }
    const feedback = await gradeOpenAnswer({
      topic,
      subtopic,
      exercise,
      answer: 'Hi, my name are Juan. I have 30 years and I am engineer. I am from rosario and I am very happy.'
    })
    console.log(JSON.stringify(feedback, null, 2))
    expect(feedback.score).toBeLessThan(10)
    expect(feedback.review?.mistakes.length).toBeGreaterThan(0)
  }, 180_000)
})
