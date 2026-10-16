import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ClaudeError, explainFailure, shouldRetry, toClaudeJsonSchema } from '../src/main/claude/bridge'

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

describe('explainFailure', () => {
  it('reconoce los fallos comunes de Claude Code', () => {
    expect(explainFailure('Error: Not logged in · Please run /login').kind).toBe('auth')
    expect(explainFailure('Claude AI usage limit reached|1760000000').kind).toBe('limit')
    expect(explainFailure('API Error: 529 {"type":"overloaded_error"}').kind).toBe('overloaded')
    expect(explainFailure('getaddrinfo ENOTFOUND api.anthropic.com').kind).toBe('offline')
    expect(explainFailure('algo raro').kind).toBe('unknown')
  })

  it('solo se reintenta lo que puede salir bien al repetirlo', () => {
    expect(shouldRetry(new Error('formato'))).toBe(true)
    expect(shouldRetry(new ClaudeError('x', 'format'))).toBe(true)
    expect(shouldRetry(new ClaudeError('x', 'cancelled'))).toBe(false)
    expect(shouldRetry(new ClaudeError('x', 'timeout'))).toBe(false)
    expect(shouldRetry(new ClaudeError('x', 'limit'))).toBe(false)
  })
})
