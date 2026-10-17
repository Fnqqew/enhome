// Generar → revisar pruebas con un Claude simulado.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { generateExam, type ExamRequest } from '../../src/main/exams/generation'
import type { ExerciseType } from '../../src/shared/exercises'
import { fakeClaude, generatedSample as sample } from '../helpers/exercises'

const topic = loadCurriculum(join(__dirname, '..', '..', 'content')).find((t) => t.id === 'a1-to-be')!

const types: ExerciseType[] = ['multiple_choice', 'fill_blank', 'multiple_choice', 'fill_blank', 'multiple_choice']
const request: ExamRequest = {
  kind: 'weekly',
  level: 'A1',
  items: types.map((type, i) => ({ topic, subtopic: topic.subtopics[i], type })),
  focusNotes: ['Falló más en pronombres.']
}
const items = (marker: string) => types.map((type, index) => ({ index, exercise: sample(type, marker) }))
const noCorrections = { issues: [], corrections: [] }

describe('generateExam', () => {
  it('ubica las preguntas por número, aplica las correcciones y etiqueta cada una', async () => {
    const shuffled = [...items('ORIGINAL')].reverse()
    const { ask, prompts } = fakeClaude([
      { items: shuffled },
      { issues: ['x'], corrections: [{ index: 2, replacement: sample('multiple_choice', 'REVISADA') }] }
    ])
    const questions = await generateExam(request, ask)

    expect(questions).toHaveLength(5)
    expect(questions.map((q) => q.subtopicId)).toEqual(topic.subtopics.map((s) => s.id))
    const q2 = questions[2].exercise
    expect(q2.type === 'multiple_choice' && q2.prompt).toContain('REVISADA')
    expect(prompts[0]).toContain('Falló más en pronombres.')
    expect(prompts[1]).toContain('ORIGINAL')
  })

  it('descarta hasta 2 preguntas del tipo equivocado', async () => {
    const wrong = items('A').map((item, i) => (i < 2 ? { ...item, exercise: sample(types[i] === 'fill_blank' ? 'multiple_choice' : 'fill_blank', 'A') } : item))
    const { ask } = fakeClaude([{ items: wrong }, noCorrections])
    expect(await generateExam(request, ask)).toHaveLength(3)
  })

  it('el revisor puede completar una pregunta que faltaba', async () => {
    const { ask } = fakeClaude([{ items: items('A').slice(1) }, { issues: ['faltaba'], corrections: [{ index: 0, replacement: sample('multiple_choice', 'NUEVA') }] }])
    const questions = await generateExam(request, ask)
    expect(questions).toHaveLength(5)
  })

  it('con demasiadas preguntas inválidas vuelve a intentar y después falla', async () => {
    const { ask, prompts } = fakeClaude([{ items: items('A').slice(0, 2) }, noCorrections, { items: items('B').slice(0, 2) }, noCorrections])
    await expect(generateExam(request, ask)).rejects.toThrow(/faltan 3/)
    expect(prompts).toHaveLength(4)
  })

  it('nunca entrega preguntas sin revisar', async () => {
    const { ask } = fakeClaude([{ items: items('A') }, new Error('caída'), { items: items('B') }, new Error('caída')])
    await expect(generateExam(request, ask)).rejects.toThrow('caída')
  })
})
