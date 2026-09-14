import { DEFAULT_SETTINGS, settingsSchema, type AppSettings } from '../../shared/settings'
import type { Db } from './database'

// Cada preferencia es una fila; los valores inválidos o faltantes vuelven al valor por defecto.
export function loadSettings(db: Db): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue
    const field = settingsSchema.shape[key as keyof AppSettings].safeParse(JSON.parse(value))
    if (field.success) settings[key] = field.data
  }
  return settings as AppSettings
}

export function updateSettings(db: Db, patch: unknown): AppSettings {
  const valid = settingsSchema.partial().strict().parse(patch)
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
  for (const [key, value] of Object.entries(valid)) {
    if (value !== undefined) upsert.run(key, JSON.stringify(value))
  }
  return loadSettings(db)
}
