// Diario en el idioma del curso: una entrada corta por día que Claude corrige y queda guardada,
// para ver cómo evoluciona la escritura.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { addDays } from '../../shared/dates'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { MAX_JOURNAL_LENGTH, type JournalEntry, type JournalReview, type JournalView } from '../../shared/reading'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt, spanish } from '../claude/quality'
import type { Db } from '../db/database'
import type { Progression } from '../engine/progression'

export class JournalError extends Error {}

const reviewSchema = z.object({
  correctedText: z.string(),
  comments: z.string().min(1),
  mistakes: z.array(z.object({ fragment: z.string(), correction: z.string(), explanation: z.string() })).max(8),
  tip: z.string(),
  score: z.number().int().min(0).max(10)
})

interface JournalRow {
  day: string
  text: string
  review: string | null
  created_at: string
  updated_at: string | null
}

// Ideas para escribir, rotan según el día.
const PROMPTS = [
  '¿Qué hiciste hoy? Contalo en orden, con horarios.',
  'Describí tu casa o tu barrio a alguien que no lo conoce.',
  '¿Qué planes tenés para el fin de semana?',
  'Contá una comida que te guste y cómo se prepara.',
  'Escribile un mensaje a un amigo que vive lejos.',
  '¿Qué harías si tuvieras un mes de vacaciones?',
  'Contá un recuerdo de cuando eras chico.',
  'Opiná: ¿es mejor vivir en una ciudad grande o en un pueblo?',
  'Describí a una persona que admirás y por qué.',
  'Contá algo que aprendiste esta semana.'
]

export function buildJournalPrompt(text: string, topic: CurriculumTopic): string {
  const target = languageInfo(topic.language).promptName
  return `Un alumno hispanohablante de nivel ${topic.level} que estudia ${target} escribió esta entrada de su diario:
«${text}»

Esta semana estudia: ${topic.title} (${topic.targetTitle}).

Corregila como un buen profesor particular:
- correctedText: el texto corregido con los cambios mínimos para que quede correcto y natural (sin reescribirlo con otras ideas).
- comments: 2 o 3 oraciones en ${spanish()}, empezando por algo que hizo bien y terminando con un consejo concreto.
- mistakes: hasta 8 errores reales, con fragment copiado tal cual lo escribió, correction y una explanation breve en español. Vacío si no hay.
- tip: una palabra o expresión natural en ${target} que le serviría para lo que quiso contar, con su traducción entre paréntesis.
- score: de 0 a 10 según corrección y riqueza para su nivel.

Si escribió partes en español, ayudalo con cómo se dicen en ${target} dentro de correctedText. Verificá tu corrección antes de responder.`
}

export class Journal {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly progression: Progression,
    private readonly language: LanguageId,
    private readonly ask: Ask = askClaude
  ) {}

  view(today: string): JournalView {
    const rows = this.db.prepare('SELECT * FROM journal ORDER BY day DESC LIMIT 60').all() as unknown as JournalRow[]
    const entries = rows.map((r) => this.entry(r))
    const days = new Set(rows.map((r) => r.day))
    // Días seguidos con entrada, contando hoy o ayer como punto de partida.
    let streak = 0
    let day = days.has(today) ? today : addDays(today, -1)
    while (days.has(day)) {
      streak++
      day = addDays(day, -1)
    }
    const index = Number(today.replaceAll('-', '')) % PROMPTS.length
    return {
      today: entries.find((e) => e.day === today) ?? null,
      past: entries.filter((e) => e.day !== today),
      streak,
      prompts: [PROMPTS[index], PROMPTS[(index + 3) % PROMPTS.length], PROMPTS[(index + 7) % PROMPTS.length]]
    }
  }

  // Guarda el borrador de hoy (sin corregir).
  save(text: string, today: string): JournalView {
    const clean = text.trim().slice(0, MAX_JOURNAL_LENGTH)
    if (!clean) {
      this.db.prepare('DELETE FROM journal WHERE day = ? AND review IS NULL').run(today)
      return this.view(today)
    }
    this.db
      .prepare(
        `INSERT INTO journal (day, text) VALUES (?, ?)
         ON CONFLICT (day) DO UPDATE SET text = excluded.text, updated_at = datetime('now')`
      )
      .run(today, clean)
    return this.view(today)
  }

  async correct(today: string): Promise<JournalView> {
    const row = this.db.prepare('SELECT * FROM journal WHERE day = ?').get(today) as JournalRow | undefined
    if (!row || row.text.trim().split(/\s+/).length < 5) throw new JournalError('Escribí al menos una o dos oraciones antes de pedir la corrección.')
    const review = await this.ask({
      label: 'diario',
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Corregís con precisión y de forma alentadora.'),
      prompt: buildJournalPrompt(row.text, this.topic(today)),
      schema: reviewSchema
    })
    this.db.prepare("UPDATE journal SET review = ?, updated_at = datetime('now') WHERE day = ?").run(JSON.stringify({ ...review, text: row.text }), today)
    return this.view(today)
  }

  private topic(today: string): CurriculumTopic {
    const weekTopic = this.progression.getState(today).week?.topicId
    return this.curriculum.find((t) => t.id === weekTopic) ?? this.curriculum[0]
  }

  private entry(row: JournalRow): JournalEntry {
    const stored = row.review ? (JSON.parse(row.review) as JournalReview & { text?: string }) : null
    const review: JournalReview | null = stored
      ? { correctedText: stored.correctedText, comments: stored.comments, mistakes: stored.mistakes, tip: stored.tip, score: stored.score }
      : null
    return { day: row.day, text: row.text, review, edited: stored !== null && stored.text !== undefined && stored.text !== row.text }
  }
}
