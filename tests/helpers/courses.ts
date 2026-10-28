// Los cursos que ya tienen temario: los idiomas nuevos se suman a las pruebas a medida que tienen contenido.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadCurriculum } from '../../src/main/content/curriculum'
import type { CurriculumTopic } from '../../src/shared/curriculum'
import { LANGUAGE_IDS } from '../../src/shared/languages'

export const CONTENT_DIR = join(__dirname, '..', '..', 'content')

export const COURSES = LANGUAGE_IDS.filter((id) => existsSync(join(CONTENT_DIR, id, 'A1')))

// Los 25 tópicos originales de inglés (los que se sumaron después llevan el prefijo «en-»): las pruebas
// del motor usan este temario fijo para no depender de cómo crece el contenido.
export function englishCore(): CurriculumTopic[] {
  return loadCurriculum(CONTENT_DIR, 'en').filter((t) => !t.id.startsWith('en-'))
}
