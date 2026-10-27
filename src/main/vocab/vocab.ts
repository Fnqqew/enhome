// Vocabulario: Claude traduce una palabra en su contexto y el alumno la guarda para repasarla con tarjetas.

import { z } from 'zod'
import type { CurriculumTopic } from '../../shared/curriculum'
import { languageInfo, type LanguageId } from '../../shared/languages'
import { MAX_SENTENCE_LENGTH, MAX_TERM_LENGTH, type VocabCard, type VocabOverview, type WordInfo } from '../../shared/vocab'
import { askClaude, type Ask } from '../claude/bridge'
import { roleSystemPrompt, spanish } from '../claude/quality'
import type { Db } from '../db/database'
import { addCard, dueCards, getCard, removeCard, reviewCard, strength, type CardRow } from '../review/cards'

export class VocabError extends Error {}

const lookupSchema = z.object({
  term: z.string().min(1),
  translation: z.string().min(1),
  example: z.string().min(1),
  exampleEs: z.string().min(1),
  note: z.string()
})

interface WordExtra {
  example: string
  exampleEs: string
  note: string
}

const card = (r: CardRow): VocabCard => {
  const extra = (r.payload ? JSON.parse(r.payload) : {}) as Partial<WordExtra>
  return {
    id: r.id,
    kind: r.kind === 'phrase' || r.kind === 'sentence' ? r.kind : 'word',
    term: r.front,
    translation: r.back,
    example: extra.example ?? '',
    exampleEs: extra.exampleEs ?? '',
    note: extra.note ?? '',
    stage: strength(r),
    dueOn: r.due_on,
    createdOn: r.created_on
  }
}

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
      cache: true,
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
    addCard(
      this.db,
      {
        kind: 'word',
        source: 'vocab',
        sourceKey: term.toLowerCase(),
        front: term,
        back: info.translation.trim(),
        payload: { example: info.example.trim(), exampleEs: info.exampleEs.trim(), note: info.note.trim() } satisfies WordExtra
      },
      today
    )
    return this.overview(today)
  }

  // Guarda una oración entera (de una lectura) para repasarla: Claude la traduce una vez.
  async saveSentence(sentence: string, today: string): Promise<VocabOverview> {
    const clean = sentence.trim().replace(/\s+/g, ' ').slice(0, MAX_SENTENCE_LENGTH)
    if (!clean) throw new VocabError('Elegí una oración para guardar.')
    const { translation } = await this.ask({
      label: 'oración',
      effort: 'low',
      cache: true,
      systemPrompt: roleSystemPrompt(this.language, 'docente', 'Traducís oraciones con naturalidad.'),
      prompt: `Traducí esta oración del ${languageInfo(this.language).name} al ${spanish()}, con naturalidad (como lo diría un hablante, no palabra por palabra). Campos: { translation }.\n\n${clean}`,
      schema: z.object({ translation: z.string().trim().min(1) }),
      timeoutMs: 60_000
    })
    addCard(this.db, { kind: 'sentence', source: 'reading', sourceKey: clean.toLowerCase(), front: clean, back: translation }, today)
    return this.overview(today)
  }

  overview(today: string): VocabOverview {
    const rows = this.db.prepare("SELECT * FROM cards WHERE kind IN ('word', 'phrase', 'sentence') ORDER BY id DESC").all() as unknown as CardRow[]
    const cards = rows.map(card)
    return { cards, dueToday: cards.filter((c) => c.dueOn <= today).length }
  }

  due(today: string): VocabCard[] {
    return dueCards(this.db, ['word', 'phrase', 'sentence'], today, 30).map(card)
  }

  // Me la sabía o no: FSRS decide cuándo vuelve.
  review(id: number, knew: boolean, today: string): VocabCard {
    this.row(id)
    return card(reviewCard(this.db, id, knew ? 'good' : 'again', today).card)
  }

  remove(id: number, today: string): VocabOverview {
    this.row(id)
    removeCard(this.db, id)
    return this.overview(today)
  }

  private find(term: string): CardRow | null {
    return (this.db.prepare("SELECT * FROM cards WHERE kind = 'word' AND source_key = lower(?)").get(term.trim()) as CardRow | undefined) ?? null
  }

  private row(id: number): CardRow {
    const row = getCard(this.db, id)
    if (!row || row.kind === 'mistake') throw new VocabError('Esa palabra no está en tu vocabulario.')
    return row
  }

  // El nivel del alumno para el ejemplo: el del tópico de la semana o el del primero.
  levelOf(topicId: string | null): string {
    return this.curriculum.find((t) => t.id === topicId)?.level ?? this.curriculum[0]?.level ?? 'A1'
  }
}
