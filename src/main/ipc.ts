import { ipcMain } from 'electron'
import { z } from 'zod'
import { askClaude, getClaudeStatus } from './claude/bridge'
import { loadCurriculum } from './content/curriculum'
import type { Db } from './db/database'
import { loadSettings, updateSettings } from './db/settings-repo'
import type { CurriculumTopic } from '../shared/curriculum'
import { IPC, type Result, type SampleSentence } from '../shared/ipc'

// Envuelve cada handler para que la interfaz reciba un Result en vez de un error de Electron.
function handle<T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<Result<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      console.error(`[ipc] ${channel}`, err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registerIpc(db: Db, contentDir: string): void {
  // Se carga una vez; si el contenido tiene errores, el mensaje llega a la interfaz.
  let curriculum: CurriculumTopic[] | null = null
  handle(IPC.curriculumList, () => (curriculum ??= loadCurriculum(contentDir)))

  handle(IPC.claudeStatus, () => getClaudeStatus())

  handle(IPC.claudeSample, (): Promise<SampleSentence> =>
    askClaude({
      systemPrompt: 'Sos un generador de contenido para una app de inglés para hispanohablantes. Respondé solo con lo pedido.',
      prompt: 'Dame una oración simple en inglés de nivel A1 y su traducción al español rioplatense.',
      schema: z.object({ english: z.string(), spanish: z.string() })
    })
  )

  handle(IPC.settingsGet, () => loadSettings(db))
  handle(IPC.settingsUpdate, (patch) => updateSettings(db, patch))
}
