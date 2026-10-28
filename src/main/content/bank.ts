// Lee los bancos de ejercicios del temario (banco.json de cada tópico). Un ejercicio que no pasa el
// esquema o los controles se descarta con un aviso, sin romper el resto.

import { BANK_FILES, type Difficulty } from '../../shared/difficulty'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bankFileSchema, isBankType, type BankFile } from '../../shared/bank'
import type { CurriculumTopic } from '../../shared/curriculum'
import { prepareExercise } from '../../shared/exercise-types'
import { generatedExerciseSchema, type GeneratedExercise } from '../../shared/exercises'
import type { LanguageId } from '../../shared/languages'

export interface LoadedBank {
  // Ejercicios válidos por subtema.
  subtopics: Map<string, GeneratedExercise[]>
  problems: string[]
}

// La carpeta de un tópico: content/<idioma>/<nivel>/<nn-slug>/ (se busca la que tiene ese id).
export function topicDir(contentDir: string, language: LanguageId, topic: Pick<CurriculumTopic, 'id' | 'level'>): string | null {
  const levelDir = join(contentDir, language, topic.level)
  if (!existsSync(levelDir)) return null
  for (const entry of readdirSync(levelDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(levelDir, entry.name, 'topic.json')
    if (!existsSync(file)) continue
    try {
      if ((JSON.parse(readFileSync(file, 'utf8')) as { id?: string }).id === topic.id) return join(levelDir, entry.name)
    } catch {
      // Un topic.json roto lo informa el cargador del temario.
    }
  }
  return null
}

export function bankPath(
  contentDir: string,
  language: LanguageId,
  topic: Pick<CurriculumTopic, 'id' | 'level'>,
  difficulty: Difficulty = 'normal'
): string | null {
  const dir = topicDir(contentDir, language, topic)
  return dir ? join(dir, BANK_FILES[difficulty]) : null
}

export function readBank(path: string | null, topic: Pick<CurriculumTopic, 'id' | 'subtopics'>): LoadedBank {
  const subtopics = new Map<string, GeneratedExercise[]>()
  const problems: string[] = []
  if (!path || !existsSync(path)) return { subtopics, problems }
  let file: BankFile
  try {
    file = bankFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (err) {
    return { subtopics, problems: [`${topic.id}/banco.json es inválido: ${err instanceof Error ? err.message : String(err)}`] }
  }
  const known = new Set(topic.subtopics.map((s) => s.id))
  for (const [subtopicId, items] of Object.entries(file.subtopics)) {
    if (!known.has(subtopicId)) {
      problems.push(`${topic.id}/banco.json: el subtema ${subtopicId} no existe`)
      continue
    }
    const valid: GeneratedExercise[] = []
    items.forEach((item, i) => {
      const where = `${topic.id}/${subtopicId} #${i + 1}`
      const parsed = generatedExerciseSchema.safeParse(item)
      if (!parsed.success) {
        problems.push(`${where}: no cumple el formato`)
      } else if (!isBankType(parsed.data.type)) {
        problems.push(`${where}: el formato ${parsed.data.type} no va en el banco`)
      } else {
        try {
          prepareExercise(parsed.data)
          valid.push(parsed.data)
        } catch (err) {
          problems.push(`${where}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    })
    subtopics.set(subtopicId, valid)
  }
  return { subtopics, problems }
}

// Guarda un banco (lo usa la herramienta que los genera).
export function writeBank(path: string, subtopics: Record<string, GeneratedExercise[]>): void {
  writeFileSync(path, JSON.stringify({ subtopics } satisfies BankFile, null, 2) + '\n')
}

// Los bancos de un curso, leídos la primera vez que se piden.
export class CourseBanks {
  private readonly cache = new Map<string, LoadedBank>()

  constructor(
    private readonly contentDir: string,
    private readonly language: LanguageId
  ) {}

  forTopic(topic: CurriculumTopic, difficulty: Difficulty = 'normal'): LoadedBank {
    const key = `${topic.id}:${difficulty}`
    let bank = this.cache.get(key)
    if (!bank) {
      bank = readBank(bankPath(this.contentDir, this.language, topic, difficulty), topic)
      for (const problem of bank.problems) console.warn(`[banco] ${problem}`)
      this.cache.set(key, bank)
    }
    return bank
  }
}
