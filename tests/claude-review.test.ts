// Flujo generar → revisar de los contenidos que produce Claude, con un Claude simulado.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Ask, AskOptions } from '../src/main/claude/bridge'
import { applyCorrections } from '../src/main/claude/quality'
import { loadCurriculum } from '../src/main/content/curriculum'
import { generatePlacementQuestions } from '../src/main/engine/placement-questions'
import { planPool } from '../src/main/practice/composition'
import { generatePracticePool } from '../src/main/practice/generation'
import type { ExerciseType, GeneratedExercise } from '../src/shared/exercises'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'))
const topic = curriculum.find((t) => t.id === 'a1-to-be')!
const subtopic = topic.subtopics[0]

// Devuelve las respuestas en orden (validadas con el esquema pedido) y guarda los prompts.
function fakeClaude(responses: unknown[]): { ask: Ask; prompts: string[] } {
  const prompts: string[] = []
  const ask = (async (options: AskOptions<unknown>) => {
    prompts.push(options.prompt)
    const next = responses.shift()
    if (next instanceof Error) throw next
    return options.schema.parse(next)
  }) as Ask
  return { ask, prompts }
}

function sample(type: ExerciseType, marker: string): GeneratedExercise {
  switch (type) {
    case 'multiple_choice':
      return { type, instruction: 'i', prompt: `${marker} She ___ happy.`, options: ['is', 'are', 'am', 'be'], correctIndex: 0, explanation: 'x' }
    case 'fill_blank':
      return { type, instruction: 'i', sentence: 'They ___ here.', hint: '(be)', answers: ['are'], explanation: 'x' }
    case 'word_order':
      return { type, instruction: 'i', sentence: 'She is my sister.', alternatives: [], translation: 't', explanation: 'x' }
    case 'error_correction':
      return { type, instruction: 'i', sentence: 'She are happy.', answers: ['She is happy.'], explanation: 'x' }
    case 'translation':
      return { type, instruction: 'i', spanish: 'Soy docente.', answers: ["I'm a teacher."], explanation: 'x' }
    case 'reading': {
      const q = { prompt: 'p', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'x' }
      return { type, instruction: 'i', text: 't', questions: [q, { ...q, prompt: 'q' }] }
    }
    case 'writing':
      return { type, instruction: 'i', task: 't', minWords: 20, maxWords: 50, guidance: ['g'], sampleAnswer: 's' }
  }
}

const counts = planPool(subtopic.focus)
const pool = (marker: string): GeneratedExercise[] =>
  (Object.entries(counts) as [ExerciseType, number][]).flatMap(([type, n]) => Array.from({ length: n }, () => sample(type, marker)))
const request = { topic, subtopic, kind: 'lesson' as const, counts, avoid: [] }
const noCorrections = { issues: [], corrections: [] }
const indexesOf = (type: ExerciseType): number[] => pool('').flatMap((e, i) => (e.type === type ? [i] : []))

describe('applyCorrections', () => {
  it('reemplaza por posición e ignora lo fuera de rango o de otro tipo', () => {
    const items = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }]
    const result = applyCorrections(
      items,
      [
        { index: 0, replacement: { type: 'a', v: 10 } },
        { index: 1, replacement: { type: 'a', v: 20 } },
        { index: 5, replacement: { type: 'a', v: 50 } }
      ],
      (x, y) => x.type === y.type
    )
    expect(result.map((r) => r.v)).toEqual([10, 2])
  })
})

describe('ejercicios de práctica', () => {
  it('aplica las correcciones del revisor y le pasa lo generado', async () => {
    const [mcIndex] = indexesOf('multiple_choice')
    const { ask, prompts } = fakeClaude([
      { exercises: pool('ORIGINAL') },
      { issues: ['Había dos opciones correctas.'], corrections: [{ index: mcIndex, replacement: sample('multiple_choice', 'REVISADO') }] }
    ])
    const exercises = await generatePracticePool(request, ask)

    expect(prompts).toHaveLength(2)
    expect(prompts[1]).toContain('ORIGINAL')
    const prompts2 = exercises.flatMap((e) => (e.type === 'multiple_choice' ? [e.prompt] : []))
    expect(prompts2.filter((p) => p.startsWith('REVISADO'))).toHaveLength(1)
    expect(prompts2.filter((p) => p.startsWith('ORIGINAL'))).toHaveLength(prompts2.length - 1)
  })

  it('si la revisión falla, vuelve a generar y revisar', async () => {
    const { ask, prompts } = fakeClaude([{ exercises: pool('A') }, new Error('revisión caída'), { exercises: pool('B') }, noCorrections])
    await expect(generatePracticePool(request, ask)).resolves.toHaveLength(pool('B').length)
    expect(prompts).toHaveLength(4)
  })

  it('nunca entrega ejercicios sin revisar', async () => {
    const { ask } = fakeClaude([{ exercises: pool('A') }, new Error('caída'), { exercises: pool('B') }, new Error('caída')])
    await expect(generatePracticePool(request, ask)).rejects.toThrow('caída')
  })

  it('descarta ejercicios que no pasan los controles y falla si falta un tipo', async () => {
    const broken = { ...sample('error_correction', ''), sentence: 'She is happy.' }
    const corrections = { issues: [], corrections: indexesOf('error_correction').map((index) => ({ index, replacement: broken })) }
    const { ask } = fakeClaude([{ exercises: pool('A') }, corrections, { exercises: pool('A') }, corrections])
    await expect(generatePracticePool(request, ask)).rejects.toThrow(/error_correction/)
  })
})

describe('preguntas del examen inicial', () => {
  const questions = (marker: string) =>
    topic.subtopics.slice(0, 3).map((s) => ({
      subtopicId: s.id,
      instruction: 'i',
      prompt: `${marker} ${s.id}`,
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 1,
      explanation: 'x'
    }))

  it('aplica las correcciones del revisor', async () => {
    const fixed = { ...questions('REVISADO')[2], correctIndex: 2 }
    const { ask, prompts } = fakeClaude([{ questions: questions('ORIGINAL') }, { issues: ['x'], corrections: [{ index: 2, replacement: fixed }] }])
    const result = await generatePlacementQuestions(topic, ask)

    expect(prompts[1]).toContain('ORIGINAL')
    expect(result.map((q) => q.prompt.split(' ')[0])).toEqual(['ORIGINAL', 'ORIGINAL', 'REVISADO'])
    expect(result[2].options[result[2].correctIndex]).toBe('c')
  })
})
