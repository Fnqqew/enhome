// npm run content:check: revisa todo el contenido de cada idioma y muestra cuánto hay en cada nivel.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditContent } from '../../src/main/content/audit'
import { LANGUAGE_IDS } from '../../src/shared/languages'

const CONTENT_DIR = join(__dirname, '..', '..', 'content')
const COURSES = LANGUAGE_IDS.filter((language) => existsSync(join(CONTENT_DIR, language, 'A1')))

describe.each(COURSES)('contenido de %s', (language) => {
  it('no tiene errores', () => {
    const report = auditContent(CONTENT_DIR, language)
    // Con npm run content:check muestra el resumen de cada nivel y los avisos.
    if (process.env.npm_lifecycle_event === 'content:check') {
      console.table(report.levels)
      if (report.warnings.length > 0) console.log(`Avisos (${report.warnings.length}):\n- ${report.warnings.slice(0, 30).join('\n- ')}`)
    }
    expect(report.errors).toEqual([])
  })
})
