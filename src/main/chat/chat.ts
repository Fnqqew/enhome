// Charla con Claude: conversación libre en el idioma del curso. Claude responde como un
// interlocutor de verdad y, aparte, corrige cada mensaje del alumno.

import { z } from 'zod'
import type { ChatCorrection, ChatMessage, ChatSuggestion, ChatSummary, ChatView } from '../../shared/chat'
import type { CurriculumTopic } from '../../shared/curriculum'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt } from '../claude/quality'
import type { Db } from '../db/database'
import type { Progression } from '../engine/progression'

export class ChatError extends Error {}

// Cuántos mensajes anteriores ve Claude: alcanza para seguir el hilo sin hacer lento cada pedido.
const HISTORY = 14

const openingSchema = z.object({ reply: z.string().min(1) })
const turnSchema = z.object({
  reply: z.string().min(1),
  correction: z.object({ ok: z.boolean(), corrected: z.string(), notes: z.array(z.string()).max(4) })
})

// Situaciones siempre disponibles, además de las del tópico de la semana.
const GENERAL: ChatSuggestion[] = [
  { title: 'Charla libre', scenario: 'Una charla libre y amistosa: Claude te pregunta por tu día y tus intereses.' },
  { title: 'En un café', scenario: 'Estás en un café: pedís algo, preguntás por el menú y pagás.' },
  { title: 'Un viaje', scenario: 'Contás un viaje que hiciste o que querés hacer, y Claude te pregunta detalles.' },
  { title: 'Entrevista de trabajo', scenario: 'Una entrevista de trabajo breve: presentarte, tu experiencia y tus planes.' }
]

interface ChatRow {
  id: number
  title: string
  scenario: string
  level: string
  created_on: string
}

interface MessageRow {
  id: number
  role: 'user' | 'assistant'
  text: string
  review: string | null
}

export function buildTurnPrompt(target: string, level: string, scenario: string, history: { role: string; text: string }[], text: string): string {
  const transcript = history.map((m) => `${m.role === 'user' ? 'Alumno' : 'Vos'}: ${m.text}`).join('\n')
  return `Estás charlando en ${target} con un alumno hispanohablante de nivel ${level}.
Situación: ${scenario}

Conversación hasta ahora:
${transcript || '(recién empieza)'}
Alumno: ${text}

Devolvé:
- reply: tu respuesta en ${target}, natural y del nivel ${level} (2 a 4 oraciones), que siga la charla y termine con una pregunta o algo que invite a contestar. No corrijas en la respuesta: hablá como un interlocutor real.
- correction: la corrección del último mensaje del alumno.
  - ok: true si es correcto y natural (detalles de puntuación o mayúsculas no cuentan).
  - corrected: el mensaje corregido con los cambios mínimos (igual al original si está bien). Si escribió partes en español, cómo se dicen en ${target}.
  - notes: hasta 4 explicaciones breves en español rioplatense de lo que cambiaste. Vacío si está bien.`
}

export class Chats {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly language: LanguageId,
    private readonly ask: Ask = askClaude
  ) {}

  list(): ChatSummary[] {
    const rows = this.db
      .prepare('SELECT c.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.chat_id = c.id) AS n FROM chats c ORDER BY c.id DESC LIMIT 40')
      .all() as unknown as (ChatRow & { n: number })[]
    return rows.map((r) => ({ id: r.id, title: r.title, createdOn: r.created_on, messages: r.n }))
  }

  // Situaciones del tópico de la semana (las de cada día) y otras generales.
  suggestions(today: string): ChatSuggestion[] {
    const topic = this.topic(today)
    const fromTopic = topic.subtopics.map((s) => ({
      title: s.title,
      scenario: `Una charla en la que tenés que usar lo del subtema «${s.title}» (${topic.title}): ${s.goal}`
    }))
    return [...fromTopic, ...GENERAL]
  }

  get(id: number): ChatView {
    const chat = this.db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as ChatRow | undefined
    if (!chat) throw new ChatError('Esa charla no existe.')
    const messages = (
      this.db.prepare('SELECT id, role, text, review FROM chat_messages WHERE chat_id = ? ORDER BY id').all(id) as unknown as MessageRow[]
    ).map(
      (m): ChatMessage => ({ id: m.id, role: m.role, text: m.text, correction: m.review ? (JSON.parse(m.review) as ChatCorrection) : null })
    )
    return { id: chat.id, title: chat.title, scenario: chat.scenario, level: chat.level, messages }
  }

  // Abre la charla con un primer mensaje de Claude.
  async start(suggestion: ChatSuggestion, today: string): Promise<ChatView> {
    const topic = this.topic(today)
    const target = languageInfo(this.language).promptName
    const { reply } = await this.ask({
      label: 'charla',
      effort: 'low',
      systemPrompt: roleSystemPrompt(this.language, 'compañero de conversación', 'Charlás para que el alumno practique.'),
      prompt: `Empezá una charla en ${target} con un alumno hispanohablante de nivel ${topic.level}.
Situación: ${suggestion.scenario}
Devolvé reply: tu primer mensaje en ${target}, corto (1 a 3 oraciones), del nivel ${topic.level}, que plantee la situación y termine con una pregunta.`,
      schema: openingSchema,
      timeoutMs: 90_000
    })
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO chats (title, scenario, level, created_on) VALUES (?, ?, ?, ?)')
      .run(suggestion.title, suggestion.scenario, topic.level, today)
    const id = Number(lastInsertRowid)
    this.db.prepare("INSERT INTO chat_messages (chat_id, role, text) VALUES (?, 'assistant', ?)").run(id, reply.trim())
    return this.get(id)
  }

  async send(id: number, text: string): Promise<ChatView> {
    const chat = this.get(id)
    const clean = text.trim()
    if (!clean) throw new ChatError('Escribí algo para mandar.')
    const history = chat.messages.slice(-HISTORY)
    const turn = await this.ask({
      label: 'charla',
      effort: 'low',
      systemPrompt: roleSystemPrompt(this.language, 'compañero de conversación', 'Charlás para que el alumno practique y corregís sus mensajes aparte.'),
      prompt: buildTurnPrompt(languageInfo(this.language).promptName, chat.level, chat.scenario, history, clean),
      schema: turnSchema,
      timeoutMs: 90_000
    })
    const insert = this.db.prepare('INSERT INTO chat_messages (chat_id, role, text, review) VALUES (?, ?, ?, ?)')
    insert.run(id, 'user', clean, JSON.stringify(turn.correction))
    insert.run(id, 'assistant', turn.reply.trim(), null)
    return this.get(id)
  }

  remove(id: number): ChatSummary[] {
    this.db.prepare('DELETE FROM chats WHERE id = ?').run(id)
    return this.list()
  }

  private topic(today: string): CurriculumTopic {
    const weekTopic = this.progression.getState(today).week?.topicId
    return this.curriculum.find((t) => t.id === weekTopic) ?? this.curriculum[0]
  }
}
