import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS, type Migration } from './migrations'

export type Db = DatabaseSync

// Abre (o crea) la base y aplica las migraciones pendientes, cada una en su transacción.
export function openDatabase(path: string, migrations: Migration[] = MIGRATIONS): Db {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  )

  const current = (db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').get() as { v: number }).v
  for (const m of migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version)) {
    // Rearmar una tabla (procedimiento de SQLite): claves foráneas apagadas fuera de la transacción y
    // revisadas antes de confirmar, así nada queda apuntando a datos que no existen.
    if (m.rebuildsTables) db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN')
    try {
      db.exec(m.sql)
      if (m.rebuildsTables) {
        const broken = db.prepare('PRAGMA foreign_key_check').all()
        if (broken.length > 0) throw new Error(`quedarían ${broken.length} referencias rotas`)
      }
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      db.close()
      throw new Error(`Falló la migración ${m.version} (${m.name}): ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (m.rebuildsTables && db.isOpen) db.exec('PRAGMA foreign_keys = ON')
    }
  }
  return db
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function schemaVersion(db: Db): number {
  return (db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').get() as { v: number }).v
}
