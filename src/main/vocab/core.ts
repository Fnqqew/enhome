// El vocabulario núcleo de un idioma y las palabras que se proponen cada día.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORE_WORDS_PER_DAY, coreVocabSchema, type CoreVocabToday, type CoreWord } from '../../shared/core-vocab'
import type { LanguageId } from '../../shared/languages'
import { CurriculumError } from '../content/curriculum'
import type { Db } from '../db/database'
import { addCard } from '../review/cards'

export function loadCoreVocab(contentDir: string, language: LanguageId): CoreWord[] {
  const path = join(contentDir, language, 'vocabulario.json')
  if (!existsSync(path)) return []
  try {
    return coreVocabSchema.parse(JSON.parse(readFileSync(path, 'utf8'))).words
  } catch (err) {
    throw new CurriculumError(`${language}/vocabulario.json es inválido: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export class CoreVocabulary {
  constructor(
    private readonly db: Db,
    private readonly words: CoreWord[]
  ) {}

  // Las siguientes palabras del nivel (en orden de frecuencia) que todavía no están en las tarjetas.
  today(level: string): CoreVocabToday {
    const ofLevel = this.words.filter((w) => w.level === level)
    const known = this.known()
    const pending = ofLevel.filter((w) => !known.has(w.term.toLowerCase()))
    return { level, words: pending.slice(0, CORE_WORDS_PER_DAY), learned: ofLevel.length - pending.length, total: ofLevel.length }
  }

  // Pasa a las tarjetas las palabras elegidas (las que no son del núcleo se ignoran).
  learn(terms: string[], level: string, today: string): CoreVocabToday {
    const wanted = new Set(terms.map((t) => t.toLowerCase()))
    for (const word of this.words) {
      if (!wanted.has(word.term.toLowerCase())) continue
      addCard(
        this.db,
        {
          kind: 'word',
          source: 'core',
          sourceKey: word.term.toLowerCase(),
          front: word.term,
          back: word.es,
          payload: { example: word.example, exampleEs: word.exampleEs, note: word.theme }
        },
        today
      )
    }
    return this.today(level)
  }

  // Lo que ya está en las tarjetas (del núcleo o guardado a mano), para no proponerlo de nuevo.
  private known(): Set<string> {
    const rows = this.db.prepare("SELECT lower(front) AS term FROM cards WHERE kind = 'word'").all() as unknown as { term: string }[]
    return new Set(rows.map((r) => r.term))
  }
}
