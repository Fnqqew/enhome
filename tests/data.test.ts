import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { courseFile, DataManager } from '../src/main/data/data'
import { openDatabase, type Db } from '../src/main/db/database'
import type { LanguageId } from '../src/shared/languages'

let dir: string
let open: Map<LanguageId, Db>
let data: DataManager

const courseDb = (language: LanguageId): Db => {
  let db = open.get(language)
  if (!db) {
    db = openDatabase(join(dir, courseFile(language)))
    open.set(language, db)
  }
  return db
}

const note = (language: LanguageId, text: string): void => {
  courseDb(language).prepare("INSERT INTO feedback (kind, section, message) VALUES ('idea', 'inicio', ?)").run(text)
}
const notes = (language: LanguageId): string[] =>
  (courseDb(language).prepare('SELECT message FROM feedback ORDER BY id').all() as { message: string }[]).map((r) => r.message)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'enhome-data-'))
  open = new Map()
  data = new DataManager({ dataDir: dir, openDbs: open, courseDb })
  note('en', 'inglés')
  note('pt', 'portugués')
})

afterEach(() => {
  for (const db of open.values()) {
    try {
      db.close()
    } catch {
      // ya cerrada
    }
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('copias de seguridad', () => {
  it('una por día, con cada curso, y se guardan las últimas siete', () => {
    expect(data.backup('2026-10-16')).toMatchObject({ date: '2026-10-16', courses: 2 })
    expect(data.backup('2026-10-16')).toBeNull()
    for (let d = 1; d <= 9; d++) data.backup(`2026-10-0${d}`)
    const dates = data.backups().map((b) => b.date)
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-10-16')
  })

  it('restaurar vuelve a lo guardado en la copia', () => {
    data.backup('2026-10-16')
    note('en', 'después de la copia')
    data.restore('2026-10-16')
    expect(open.size).toBe(0)
    expect(notes('en')).toEqual(['inglés'])
  })
})

describe('exportar e importar', () => {
  it('ida y vuelta con todos los cursos, guardando antes una copia de lo actual', () => {
    const exported = data.exportData('2.0.0')
    note('pt', 'cambio local')
    data.importData(exported, '2026-10-17')
    expect(notes('pt')).toEqual(['portugués'])
    expect(data.backups().map((b) => b.date)).toContain('2026-10-17')
  })

  it('rechaza un archivo que no es una exportación', () => {
    expect(() => data.importData(Buffer.from('{"hola": 1}'), '2026-10-17')).toThrow(/no es una exportación/)
    expect(() => data.importData(Buffer.from('nada'), '2026-10-17')).toThrow(/no es una exportación/)
  })
})

describe('borrar todo', () => {
  it('borra las bases de todos los cursos', () => {
    data.backup('2026-10-16')
    data.deleteAll()
    expect(existsSync(join(dir, 'enhome.db'))).toBe(false)
    expect(existsSync(join(dir, 'enhome-pt.db'))).toBe(false)
    expect(data.backups()).toHaveLength(1)
  })
})
