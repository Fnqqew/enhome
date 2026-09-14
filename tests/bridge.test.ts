import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { toClaudeJsonSchema } from '../src/main/claude/bridge'

describe('toClaudeJsonSchema', () => {
  it('quita $schema para que Claude Code no ignore el esquema', () => {
    const jsonSchema = toClaudeJsonSchema(z.object({ english: z.string(), spanish: z.string() }))
    expect(jsonSchema).not.toHaveProperty('$schema')
    expect(jsonSchema).toMatchObject({
      type: 'object',
      properties: { english: { type: 'string' }, spanish: { type: 'string' } },
      required: ['english', 'spanish']
    })
  })
})
