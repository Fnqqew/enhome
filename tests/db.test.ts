import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, schemaVersion, type Db } from '../src/main/db/database'
import { MIGRATIONS } from '../src/main/db/migrations'
import { loadSettings, updateSettings } from '../src/main/db/settings-repo'
import { DEFAULT_SETTINGS } from '../src/shared/settings'

let dir: string
let opened: Db[]

function open(...args: Parameters<typeof openDatabase>): Db {
  const db = openDatabase(...args)
  opened.push(db)
  return db
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'proyecto-ingles-test-'))
  opened = []
})

afterEach(() => {
  for (const db of opened) if (db.isOpen) db.close()
  rmSync(dir, { recursive: true, force: true })
})

const latest = MIGRATIONS[MIGRATIONS.length - 1].version

describe('openDatabase', () => {
  it('aplica todas las migraciones en una base nueva', () => {
    const db = open(':memory:')
    expect(schemaVersion(db)).toBe(latest)
    expect(db.prepare('SELECT id FROM player').all()).toHaveLength(1)
  })

  it('no vuelve a aplicar migraciones al reabrir', () => {
    const path = join(dir, 'app.db')
    open(path).close()
    const db = open(path)
    expect(schemaVersion(db)).toBe(latest)
    expect(db.prepare('SELECT id FROM player').all()).toHaveLength(1)
  })

  it('revierte por completo una migración que falla', () => {
    const path = join(dir, 'app.db')
    const broken = [...MIGRATIONS, { version: 99, name: 'rota', sql: 'CREATE TABLE temporal (a); INSERT INTO no_existe VALUES (1);' }]
    expect(() => open(path, broken)).toThrow(/99/)

    const db = open(path)
    expect(schemaVersion(db)).toBe(latest)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'temporal'").get()).toBeUndefined()
  })
})

describe('settings', () => {
  it('devuelve los valores por defecto en una base nueva', () => {
    expect(loadSettings(open(':memory:'))).toEqual(DEFAULT_SETTINGS)
  })

  it('guarda cambios parciales y conserva el resto', () => {
    const path = join(dir, 'app.db')
    const db = open(path)
    updateSettings(db, { palette: 'salvia', theme: 'dark' })
    updateSettings(db, { fontSize: 'lg' })
    db.close()

    expect(loadSettings(open(path))).toEqual({ ...DEFAULT_SETTINGS, palette: 'salvia', theme: 'dark', fontSize: 'lg' })
  })

  it('rechaza valores inválidos o claves desconocidas sin guardar nada', () => {
    const db = open(':memory:')
    expect(() => updateSettings(db, { palette: 'neon' })).toThrow()
    expect(() => updateSettings(db, { volumen: 10 })).toThrow()
    expect(loadSettings(db)).toEqual(DEFAULT_SETTINGS)
  })

  it('ignora un valor guardado corrupto y usa el valor por defecto', () => {
    const db = open(':memory:')
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('palette', JSON.stringify('neon'))
    expect(loadSettings(db).palette).toBe(DEFAULT_SETTINGS.palette)
  })
})
