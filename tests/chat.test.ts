import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildTurnPrompt, Chats } from '../src/main/chat/chat'
import type { Ask } from '../src/main/claude/bridge'
import { loadCurriculum } from '../src/main/content/curriculum'
import { openDatabase, type Db } from '../src/main/db/database'
import { Progression } from '../src/main/engine/progression'

const curriculum = loadCurriculum(join(__dirname, '..', 'content'), 'fr')
const TODAY = '2026-10-16'
let db: Db
let chats: Chats
const prompts: string[] = []

const fakeAsk = (async ({ prompt }: { prompt: string }) => {
  prompts.push(prompt)
  if (prompt.startsWith('Empezá')) return { reply: 'Bonjour ! Comment ça va ?' }
  return {
    reply: 'Super ! Et tu fais quoi ce week-end ?',
    correction: { ok: false, corrected: 'Je vais bien, merci.', notes: ['Con «bien» no va «bon».'] }
  }
}) as unknown as Ask

beforeEach(() => {
  db = openDatabase(':memory:')
  chats = new Chats(db, curriculum, new Progression(db, curriculum), 'fr', fakeAsk)
})

describe('charla con Claude', () => {
  it('propone situaciones del tópico de la semana y generales', () => {
    const suggestions = chats.suggestions(TODAY)
    expect(suggestions.slice(0, 5).map((s) => s.title)).toEqual(curriculum[0].subtopics.map((s) => s.title))
    expect(suggestions.some((s) => s.title === 'Charla libre')).toBe(true)
  })

  it('abre con un mensaje de Claude, guarda la corrección de cada mensaje y se puede borrar', async () => {
    const started = await chats.start({ title: 'Charla libre', scenario: 'Una charla libre.' }, TODAY)
    expect(started.messages).toEqual([{ id: expect.any(Number), role: 'assistant', text: 'Bonjour ! Comment ça va ?', correction: null }])

    const after = await chats.send(started.id, 'Je vais bon, merci.')
    expect(after.messages.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant'])
    expect(after.messages[1].correction).toMatchObject({ ok: false, corrected: 'Je vais bien, merci.' })
    expect(prompts.at(-1)).toContain('Vos: Bonjour ! Comment ça va ?')

    expect(chats.list()[0]).toMatchObject({ title: 'Charla libre', messages: 3 })
    expect(chats.remove(started.id)).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM chat_messages').get()).toEqual({ n: 0 })
  })

  it('el pedido incluye la situación, el nivel y el historial', () => {
    const prompt = buildTurnPrompt('francés', 'A1', 'En un café.', [{ role: 'assistant', text: 'Bonjour !' }], 'Un café, merci.')
    expect(prompt).toContain('nivel A1')
    expect(prompt).toContain('Situación: En un café.')
    expect(prompt).toContain('Alumno: Un café, merci.')
  })
})

describe('charla por voz', () => {
  it('si el alumno habló, Claude no corrige lo que es de la transcripción y contesta fácil de escuchar', () => {
    const written = buildTurnPrompt('francés', 'A1', 'En un café.', [], 'Un café merci')
    const spoken = buildTurnPrompt('francés', 'A1', 'En un café.', [], 'Un café merci', true)
    expect(written).not.toContain('transcripción automática')
    expect(spoken).toContain('transcripción automática')
    expect(spoken).toContain('fáciles de entender al escucharlas')
  })
})
