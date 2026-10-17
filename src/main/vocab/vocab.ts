// Vocabulario: Claude traduce una palabra en su contexto y el alumno la guarda para repasarla con tarjetas.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { addDays } from '../../shared/dates'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { MAX_TERM_LENGTH, VOCAB_INTERVALS, type VocabCard, type VocabOverview, type WordInfo } from '../../shared/vocab'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt, spanish } from '../claude/quality'
import type { Db } from '../db/database'

export class VocabError extends Error {}

const lookupSchema = z.object({
  term: z.string().min(1),
  translation: z.string().min(1),
  example: z.string().min(1),
  exampleEs: z.string().min(1),
  note: z.string()
})

interface VocabRow {
  id: number
  term: string
  translation: string
  example: string | null
  example_es: string | null
  note: string | null
  stage: number
  due_on: string
  created_on: string
}

const card = (r: VocabRow): VocabCard => ({
  id: r.id,
  term: r.term,
  translation: r.translation,
  example: r.example ?? '',
  exampleEs: r.example_es ?? '',
  note: r.note ?? '',
  stage: r.stage,
  dueOn: r.due_on,
  createdOn: r.created_on
})

export function buildLookupPrompt(term: string, context: string, language: LanguageId, level: string): string {
  // promptName distingue la variante (portugués de Brasil).
  const target = languageInfo(language).promptName
  return `Un alumno hispanohablante (nivel ${level}) que estudia ${target} quiere saber qué significa esto: «${term}»
${context ? `Aparece en: «${context}»\n` : ''}
Devolvé:
- term: la palabra o expresión en su forma de diccionario (infinitivo, singular, masculino), en ${target}. Si es una expresión fija, la expresión completa.
- translation: la traducción al ${spanish()} que corresponde en ese contexto (si tiene otra acepción muy común, agregala después de una barra).
- example: una oración corta y natural en ${target}, de nivel ${level}, que use la palabra con ese significado.
- exampleEs: la traducción de esa oración.
- note: un dato útil y breve en español (género, plural irregular, verbo irregular, falso amigo, registro), o vacío si no hace falta.`
}

export class Vocabulary {
  constructor(
    private readonly db: Db,
    private readonly curriculum: CurriculumTopic[],
    private readonly language: LanguageId,
    private readonly ask: Ask = askClaude
  ) {}

  async lookup(term: string, context: string, level: string): Promise<WordInfo & { saved: boolean }> {
    const clean = term.trim().slice(0, MAX_TERM_LENGTH)
    if (!clean) throw new VocabError('Elegí una palabra para traducir.')
    const info = await this.ask({
      label: 'vocabulario',
      effort: 'low',
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Traducís palabras en contexto, con precisión y en pocas palabras.'),
      prompt: buildLookupPrompt(clean, context.trim().slice(0, 400), this.language, level),
      schema: lookupSchema,
      timeoutMs: 60_000
    })
    return { ...info, saved: this.find(info.term) !== null }
  }

  save(info: WordInfo, today: string): VocabOverview {
    const term = info.term.trim().slice(0, MAX_TERM_LENGTH)
    if (!term || !info.translation.trim()) throw new VocabError('Falta la palabra o su traducción.')
    if (this.find(term)) return this.overview(today)
    this.db
      .prepare('INSERT INTO vocab (term, translation, example, example_es, note, due_on, created_on) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(term, info.translation.trim(), info.example.trim(), info.exampleEs.trim(), info.note.trim(), addDays(today, VOCAB_INTERVALS[0]), today)
    return this.overview(today)
  }

  overview(today: string): VocabOverview {
    const rows = this.db.prepare('SELECT * FROM vocab ORDER BY id DESC').all() as unknown as VocabRow[]
    const cards = rows.map(card)
    return { cards, dueToday: cards.filter((c) => c.dueOn <= today).length }
  }

  due(today: string): VocabCard[] {
    return (this.db.prepare('SELECT * FROM vocab WHERE due_on <= ? ORDER BY due_on, id LIMIT 30').all(today) as unknown as VocabRow[]).map(card)
  }

  // Me la sabía: avanza un escalón. No me la sabía: vuelve mañana.
  review(id: number, knew: boolean, today: string): VocabCard {
    const row = this.row(id)
    const stage = knew ? Math.min(row.stage + 1, VOCAB_INTERVALS.length - 1) : 0
    const due = addDays(today, knew ? VOCAB_INTERVALS[stage] : VOCAB_INTERVALS[0])
    this.db.prepare('UPDATE vocab SET stage = ?, due_on = ? WHERE id = ?').run(stage, due, id)
    return card(this.row(id))
  }

  remove(id: number, today: string): VocabOverview {
    this.db.prepare('DELETE FROM vocab WHERE id = ?').run(id)
    return this.overview(today)
  }

  private find(term: string): VocabRow | null {
    return (this.db.prepare('SELECT * FROM vocab WHERE lower(term) = lower(?)').get(term.trim()) as VocabRow | undefined) ?? null
  }

  private row(id: number): VocabRow {
    const row = this.db.prepare('SELECT * FROM vocab WHERE id = ?').get(id) as VocabRow | undefined
    if (!row) throw new VocabError('Esa palabra no está en tu vocabulario.')
    return row
  }

  // El nivel del alumno para el ejemplo: el del tópico de la semana o el del primero.
  levelOf(topicId: string | null): string {
    return this.curriculum.find((t) => t.id === topicId)?.level ?? this.curriculum[0]?.level ?? 'A1'
  }
}
