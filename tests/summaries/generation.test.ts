// Generar → revisar resúmenes con un Claude simulado.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Ask, AskOptions } from '../../src/main/claude/bridge'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { answerAboutText, cleanMarkdown, generateSummary } from '../../src/main/summaries/generation'

const topic = loadCurriculum(join(__dirname, '..', '..', 'content'))[0]

function fakeClaude(responses: unknown[]): { ask: Ask; prompts: string[]; efforts: (string | undefined)[] } {
  const prompts: string[] = []
  const efforts: (string | undefined)[] = []
  const ask = (async (options: AskOptions<unknown>) => {
    prompts.push(options.prompt)
    efforts.push(options.effort)
    const next = responses.shift()
    if (next instanceof Error) throw next
    return options.schema.parse(next)
  }) as Ask
  return { ask, prompts, efforts }
}

const markdown = (label: string): string => `## ${label}\n\nUn resumen suficientemente largo para pasar el mínimo de caracteres pedido.`
const cards = (label: string) => Array.from({ length: 10 }, (_, i) => ({ front: `${label} ${i}`, back: 'b', example: 'e' }))

describe('resúmenes en Markdown', () => {
  it('usa la versión corregida por el revisor', async () => {
    const { ask, prompts, efforts } = fakeClaude([{ markdown: markdown('ORIGINAL') }, { issues: ['Un ejemplo mal traducido.'], correctedMarkdown: markdown('CORREGIDO') }])
    const content = await generateSummary(topic, 'errores', ask)
    expect(content).toEqual({ format: 'markdown', markdown: markdown('CORREGIDO') })
    expect(prompts[0]).toContain('Errores comunes')
    expect(prompts[1]).toContain('ORIGINAL')
    expect(efforts).toEqual([undefined, 'medium'])
  })

  it('si el revisor no corrige nada, queda el original', async () => {
    const { ask } = fakeClaude([{ markdown: markdown('ORIGINAL') }, { issues: [], correctedMarkdown: '' }])
    expect(await generateSummary(topic, 'esquema', ask)).toEqual({ format: 'markdown', markdown: markdown('ORIGINAL') })
  })

  it('una corrección incompleta cuenta como fallo y se reintenta', async () => {
    const { ask, prompts } = fakeClaude([
      { markdown: markdown('A') },
      { issues: ['x'], correctedMarkdown: 'corto' },
      { markdown: markdown('B') },
      { issues: [], correctedMarkdown: '' }
    ])
    expect(await generateSummary(topic, 'simple', ask)).toEqual({ format: 'markdown', markdown: markdown('B') })
    expect(prompts).toHaveLength(4)
  })

  it('nunca entrega un resumen sin revisar', async () => {
    const { ask } = fakeClaude([{ markdown: markdown('A') }, new Error('caída'), { markdown: markdown('B') }, new Error('caída')])
    await expect(generateSummary(topic, 'trucos', ask)).rejects.toThrow('caída')
  })
})

describe('cleanMarkdown', () => {
  it('saca etiquetas y bloques de código que envuelven el texto', () => {
    expect(cleanMarkdown('## Título\n\nTexto.\n</markdown>')).toBe('## Título\n\nTexto.')
    expect(cleanMarkdown('<markdown>\n## Título\n</markdown>')).toBe('## Título')
    expect(cleanMarkdown('```markdown\n## Título\n```')).toBe('## Título')
  })

  it('no toca el contenido normal', () => {
    const text = '## Título\n\n- *I am* → soy\n\n```\nno debería pasar pero se respeta\n```\n\nFin.'
    expect(cleanMarkdown(text)).toBe(text)
  })
})

describe('tarjetas', () => {
  it('aplica las correcciones por posición', async () => {
    const fixed = { front: 'CORREGIDA', back: 'b', example: 'e' }
    const { ask } = fakeClaude([{ cards: cards('T') }, { issues: ['x'], corrections: [{ index: 3, replacement: fixed }] }])
    const content = await generateSummary(topic, 'tarjetas', ask)
    if (content.format !== 'cards') throw new Error('se esperaban tarjetas')
    expect(content.cards).toHaveLength(10)
    expect(content.cards[3]).toEqual(fixed)
    expect(content.cards[2].front).toBe('T 2')
  })
})

describe('preguntas sobre un fragmento', () => {
  it('manda el fragmento y la pregunta con el contexto del tópico', async () => {
    const { ask, prompts } = fakeClaude([{ answer: 'Porque es la regla.' }])
    expect(await answerAboutText({ topic, fragment: "I'm not tired", question: '¿Por qué no amn’t?' }, ask)).toBe('Porque es la regla.')
    expect(prompts[0]).toContain("I'm not tired")
    expect(prompts[0]).toContain('¿Por qué no amn’t?')
    expect(prompts[0]).toContain(topic.title)
  })
})
