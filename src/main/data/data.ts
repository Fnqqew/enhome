// Datos del alumno: copias de seguridad diarias, exportar e importar el progreso y borrarlo todo.
// Cada curso es una base SQLite en la carpeta de datos; enhome.db es la de inglés y además guarda
// los ajustes y los comentarios.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGE_IDS, type LanguageId } from '../../shared/languages'
import type { BackupInfo } from '../../shared/data'
import type { Db } from '../db/database'

export const BACKUPS_KEPT = 7
const EXPORT_FORMAT = 'enhome-export'

export class DataError extends Error {}

export const courseFile = (language: LanguageId): string => (language === 'en' ? 'enhome.db' : `enhome-${language}.db`)

interface Options {
  dataDir: string
  // Las bases abiertas en este momento (se cierran antes de pisarlas).
  openDbs: Map<LanguageId, Db>
  // Abre (o devuelve) la base de un curso.
  courseDb: (language: LanguageId) => Db
}

export class DataManager {
  constructor(private readonly options: Options) {}

  private get backupsDir(): string {
    return join(this.options.dataDir, 'copias')
  }

  // Los cursos que tienen base guardada.
  existingCourses(): LanguageId[] {
    return LANGUAGE_IDS.filter((language) => existsSync(join(this.options.dataDir, courseFile(language))))
  }

  // Copia consistente de una base aunque esté abierta.
  private snapshot(language: LanguageId, target: string): void {
    rmSync(target, { force: true })
    this.options.courseDb(language).exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  }

  // Una copia por día de cada curso; quedan las últimas siete.
  backup(today: string, force = false): BackupInfo | null {
    const dir = join(this.backupsDir, today)
    if (existsSync(dir) && !force) return null
    mkdirSync(dir, { recursive: true })
    for (const language of this.existingCourses()) this.snapshot(language, join(dir, courseFile(language)))
    const all = this.backups()
    for (const old of all.slice(BACKUPS_KEPT)) rmSync(join(this.backupsDir, old.date), { recursive: true, force: true })
    return this.backups().find((b) => b.date === today) ?? null
  }

  backups(): BackupInfo[] {
    if (!existsSync(this.backupsDir)) return []
    return readdirSync(this.backupsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => {
        const files = readdirSync(join(this.backupsDir, e.name)).filter((f) => f.endsWith('.db'))
        const size = files.reduce((sum, f) => sum + statSync(join(this.backupsDir, e.name, f)).size, 0)
        return { date: e.name, courses: files.length, size }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  // Cierra las bases y pone en su lugar las de la copia elegida. Después hay que reiniciar la app.
  restore(date: string): void {
    const dir = join(this.backupsDir, date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !existsSync(dir)) throw new DataError('Esa copia no existe.')
    const files = readdirSync(dir).filter((f) => f.endsWith('.db'))
    if (files.length === 0) throw new DataError('La copia está vacía.')
    this.replaceAll(Object.fromEntries(files.map((f) => [f, readFileSync(join(dir, f))])))
  }

  // Todo el progreso en un solo archivo: las bases de cada curso dentro de un JSON.
  exportData(appVersion: string): Buffer {
    const tmp = join(this.options.dataDir, 'exportando')
    mkdirSync(tmp, { recursive: true })
    try {
      const files: Record<string, string> = {}
      for (const language of this.existingCourses()) {
        const target = join(tmp, courseFile(language))
        this.snapshot(language, target)
        files[courseFile(language)] = readFileSync(target).toString('base64')
      }
      return Buffer.from(JSON.stringify({ format: EXPORT_FORMAT, version: 1, appVersion, createdAt: new Date().toISOString(), files }))
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }

  // Valida el archivo exportado; si está bien, guarda una copia de lo actual y lo reemplaza.
  importData(content: Buffer, today: string): void {
    let parsed: { format?: string; files?: Record<string, string> }
    try {
      parsed = JSON.parse(content.toString('utf8')) as typeof parsed
    } catch {
      throw new DataError('El archivo no es una exportación de Enhome.')
    }
    if (parsed.format !== EXPORT_FORMAT || !parsed.files || !parsed.files['enhome.db']) {
      throw new DataError('El archivo no es una exportación de Enhome (o le falta el curso principal).')
    }
    const allowed = new Set(LANGUAGE_IDS.map(courseFile))
    const files = Object.fromEntries(
      Object.entries(parsed.files)
        .filter(([name]) => allowed.has(name))
        .map(([name, data]) => [name, Buffer.from(data, 'base64')])
    )
    for (const [name, data] of Object.entries(files)) {
      if (data.subarray(0, 15).toString('latin1') !== 'SQLite format 3') throw new DataError(`${name} no es una base válida.`)
    }
    // Por las dudas, lo de ahora queda en las copias de seguridad.
    this.backup(today, true)
    this.replaceAll(files)
  }

  // Borra el progreso de todos los cursos, los ajustes y los comentarios. Quedan las copias y el modelo de voz.
  deleteAll(): void {
    this.replaceAll({})
  }

  private replaceAll(files: Record<string, Buffer>): void {
    for (const db of this.options.openDbs.values()) {
      try {
        db.close()
      } catch {
        // Ya estaba cerrada.
      }
    }
    this.options.openDbs.clear()
    for (const language of LANGUAGE_IDS) {
      const path = join(this.options.dataDir, courseFile(language))
      for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
    }
    for (const [name, data] of Object.entries(files)) writeFileSync(join(this.options.dataDir, name), data)
  }
}
