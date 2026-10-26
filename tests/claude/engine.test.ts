import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { SessionPool } from '../../src/main/claude/pool'
import { JobQueue, type Ticket } from '../../src/main/claude/queue'
import { ClaudeSession, type Spawner } from '../../src/main/claude/session'
import { ClaudeError } from '../../src/main/claude/errors'
import { oneShotArgs, sessionArgs } from '../../src/main/claude/cli'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

// Un Claude Code de mentira que habla stream-json: responde cada línea con lo que diga reply.
function fakeClaude(reply: (message: string) => Record<string, unknown> | null): { spawner: Spawner; sent: string[]; child: () => FakeChild } {
  const sent: string[] = []
  let last: FakeChild | null = null
  const spawner: Spawner = () => {
    const child = new FakeChild()
    child.stdin.on('data', (chunk: Buffer) => {
      for (const line of String(chunk).split('\n').filter(Boolean)) {
        const content = (JSON.parse(line) as { message: { content: string } }).message.content
        sent.push(content)
        const event = reply(content)
        if (event) child.stdout.write(JSON.stringify(event) + '\n')
      }
    })
    last = child
    return child as unknown as ChildProcessWithoutNullStreams
  }
  return { spawner, sent, child: () => last! }
}

class FakeChild extends EventEmitter {
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  kill(): boolean {
    this.killed = true
    setTimeout(() => this.emit('close', null), 0)
    return true
  }
}

describe('JobQueue', () => {
  it('atiende primero lo urgente y lo de fondo de a uno', async () => {
    const queue = new JobQueue(2, 1)
    const order: string[] = []
    const gates = new Map<string, () => void>()
    const job = (name: string, ticket: Ticket): Promise<void> =>
      queue.run(ticket, () => {
        order.push(name)
        return new Promise<void>((resolve) => gates.set(name, resolve))
      })
    const jobs = [
      job('fondo1', { priority: 'background' }),
      job('fondo2', { priority: 'background' }),
      job('ya1', { priority: 'now' }),
      job('ya2', { priority: 'now' })
    ]
    await tick()
    // fondo1 entró solo; fondo2 espera porque lo de fondo ocupa un lugar; ya1 ocupa el otro.
    expect(order).toEqual(['fondo1', 'ya1'])
    gates.get('fondo1')!()
    await tick()
    await tick()
    // Al liberarse un lugar pasa lo urgente antes que el otro de fondo.
    expect(order).toEqual(['fondo1', 'ya1', 'ya2'])
    gates.get('ya1')!()
    gates.get('ya2')!()
    await tick()
    await tick()
    expect(order).toEqual(['fondo1', 'ya1', 'ya2', 'fondo2'])
    gates.get('fondo2')!()
    await Promise.all(jobs)
  })

  it('un pedido de fondo que pasa a urgente se adelanta', async () => {
    const queue = new JobQueue(1, 1)
    const order: string[] = []
    let release!: () => void
    const first = queue.run({ priority: 'now' }, () => new Promise<void>((resolve) => (release = resolve)))
    const ticket: Ticket = { priority: 'background' }
    const late = queue.run(ticket, async () => void order.push('fondo'))
    const other = queue.run({ priority: 'now' }, async () => void order.push('urgente'))
    ticket.priority = 'now'
    queue.reschedule()
    await tick()
    release()
    await Promise.all([first, late, other])
    // Con la prioridad subida, respeta el orden de llegada entre los urgentes.
    expect(order).toEqual(['fondo', 'urgente'])
  })

  it('al cancelar rechaza lo que espera turno', async () => {
    const queue = new JobQueue(1, 1)
    let release!: () => void
    const busy = queue.run({ priority: 'now' }, () => new Promise<void>((resolve) => (release = resolve)))
    const waiting = queue.run({ priority: 'now' }, async () => 'no llega')
    queue.rejectWaiting(new ClaudeError('cancelado', 'cancelled'))
    await expect(waiting).rejects.toThrow('cancelado')
    release()
    await busy
    expect(queue.active).toBe(0)
  })
})

describe('ClaudeSession', () => {
  it('manda cada pedido como una línea y devuelve el resultado estructurado', async () => {
    const fake = fakeClaude((message) => ({
      type: 'result',
      subtype: 'success',
      is_error: false,
      structured_output: { echo: message },
      duration_api_ms: 900
    }))
    const session = new ClaudeSession('k', 'claude', [], fake.spawner)
    const first = await session.send('hola', 5_000)
    const second = await session.send('chau', 5_000)
    expect(first.payload).toEqual({ echo: 'hola' })
    expect(second).toEqual({ payload: { echo: 'chau' }, apiMs: 900 })
    expect(fake.sent).toEqual(['hola', 'chau'])
    expect(session.turns).toBe(2)
    expect(session.answered).toBe(true)
  })

  it('traduce los errores y reconoce los de formato', async () => {
    let mode = 'limite'
    const fake = fakeClaude(() =>
      mode === 'limite'
        ? { type: 'result', subtype: 'success', is_error: true, result: 'Claude AI usage limit reached' }
        : { type: 'result', subtype: 'error_max_structured_output_retries', is_error: true }
    )
    const session = new ClaudeSession('k', 'claude', [], fake.spawner)
    await expect(session.send('a', 5_000)).rejects.toMatchObject({ kind: 'limit' })
    mode = 'formato'
    await expect(session.send('b', 5_000)).rejects.toMatchObject({ kind: 'format' })
  })

  it('si el proceso se cierra en medio de un pedido, falla con lo que dijo', async () => {
    const fake = fakeClaude(() => null)
    const session = new ClaudeSession('k', 'claude', [], fake.spawner)
    const pending = session.send('a', 5_000)
    fake.child().stderr.write('Error: Not logged in · Please run /login')
    await tick()
    fake.child().emit('close', 1)
    await expect(pending).rejects.toMatchObject({ kind: 'auth' })
    expect(session.alive).toBe(false)
  })

  it('corta el proceso si tarda demasiado', async () => {
    const fake = fakeClaude(() => null)
    const session = new ClaudeSession('k', 'claude', [], fake.spawner)
    await expect(session.send('a', 20)).rejects.toMatchObject({ kind: 'timeout' })
    expect(fake.child().killed).toBe(true)
  })
})

describe('SessionPool', () => {
  const session = (key: string): ClaudeSession => new ClaudeSession(key, 'claude', [], fakeClaude(() => null).spawner)

  it('reusa una sesión libre del mismo tipo y recicla las gastadas', () => {
    const pool = new SessionPool({ maxTurns: 2, idleMs: 1_000, maxIdle: 2 })
    const a = session('corrección')
    pool.give(a)
    expect(pool.take('práctica')).toBeNull()
    expect(pool.take('corrección')).toBe(a)
    a.turns = 2
    pool.give(a)
    expect(pool.size).toBe(0)
    expect(a.alive).toBe(false)
  })

  it('cierra las que llevan mucho sin usarse y no guarda más de la cuenta', () => {
    const pool = new SessionPool({ maxTurns: 5, idleMs: 1_000, maxIdle: 2 })
    const [a, b, c] = [session('a'), session('b'), session('c')]
    pool.give(a)
    pool.give(b)
    pool.give(c)
    expect(pool.size).toBe(2)
    expect(a.alive).toBe(false)
    pool.sweep(Date.now() + 5_000)
    expect(pool.size).toBe(0)
  })
})

describe('opciones de Claude Code', () => {
  const spec = { model: 'sonnet', effort: 'low' as const, systemPrompt: 'Sos docente.', jsonSchema: '{}' }

  it('aíslan cada pedido de los conectores, plugins y skills del usuario', () => {
    for (const args of [oneShotArgs(spec), sessionArgs(spec)]) {
      expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config', '--setting-sources', 'project', '--no-session-persistence']))
      expect(args[args.indexOf('--mcp-config') + 1]).toBe('{"mcpServers":{}}')
      expect(args[args.indexOf('--tools') + 1]).toBe('')
      expect(args[args.indexOf('--effort') + 1]).toBe('low')
    }
    expect(sessionArgs(spec)).toEqual(expect.arrayContaining(['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose']))
  })
})
