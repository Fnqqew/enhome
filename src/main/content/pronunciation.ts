// La guía de pronunciación de un idioma, si la tiene (content/<idioma>/pronunciacion.json).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LanguageId } from '../../shared/languages'
import { pronunciationSchema, type PronunciationGuide } from '../../shared/pronunciation'
import { CurriculumError } from './curriculum'

export function loadPronunciation(contentDir: string, language: LanguageId): PronunciationGuide | null {
  const path = join(contentDir, language, 'pronunciacion.json')
  if (!existsSync(path)) return null
  try {
    return pronunciationSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (err) {
    throw new CurriculumError(`${language}/pronunciacion.json es inválido: ${err instanceof Error ? err.message : String(err)}`)
  }
}
