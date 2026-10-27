// Los cursos que ya tienen temario: los idiomas nuevos se suman a las pruebas a medida que tienen contenido.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGE_IDS } from '../../src/shared/languages'

export const CONTENT_DIR = join(__dirname, '..', '..', 'content')

export const COURSES = LANGUAGE_IDS.filter((id) => existsSync(join(CONTENT_DIR, id, 'A1')))
