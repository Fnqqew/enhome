// Charla real con Claude (gasta uso de la suscripción). Solo corre con LIVE_CLAUDE=1.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Chats } from '../../src/main/chat/chat'
import { loadCurriculum } from '../../src/main/content/curriculum'
import { openDatabase } from '../../src/main/db/database'
import { Progression } from '../../src/main/engine/progression'

describe.skipIf(!process.env.LIVE_CLAUDE)('charla con Claude en vivo', () => {
  it('abre, responde y corrige en portugués', async () => {
    const curriculum = loadCurriculum(join(__dirname, '..', '..', 'content'), 'pt')
    const db = openDatabase(':memory:')
    const chats = new Chats(db, curriculum, new Progression(db, curriculum), 'pt')
    const started = Date.now()
    const chat = await chats.start(
      { title: 'Em um café', scenario: 'Estás en un café de São Paulo: pedís algo y charlás con el mozo.' },
      '2026-10-16'
    )
    const opened = Date.now()
    const after = await chats.send(chat.id, 'Eu quero um café com leite e um pão de queijo, por favor. Quanto é?')
    const lines = [
      `apertura (${Math.round((opened - started) / 1000)} s): ${after.messages[0].text}`,
      `respuesta (${Math.round((Date.now() - opened) / 1000)} s): ${after.messages[2].text}`,
      `corrección: ${JSON.stringify(after.messages[1].correction)}`
    ]
    writeFileSync(join(__dirname, 'chat.txt'), lines.join('\n'))
    expect(after.messages).toHaveLength(3)
  }, 300_000)
})
