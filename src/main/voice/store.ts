// Las voces bajadas: cada una en su carpeta dentro de <datos>/voces. La primera vez se baja el archivo
// de la versión «tts-models» de sherpa-onnx (modelo, fichas y fonetizador) y se descomprime con el tar
// de Windows. Después funciona sin conexión.

import { net } from 'electron'
import { execFile } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SUPERTONIC_ARCHIVE, VOICE_RELEASES, voiceArchive, type Voice } from '../../shared/voice'

export interface VoiceFiles {
  dir: string
  // Piper: el modelo, las fichas y los datos del fonetizador.
  model?: string
  tokens?: string
  dataDir?: string
}

export class VoiceStore {
  private readonly installs = new Map<string, Promise<void>>()
  private readonly progress = new Map<string, number>()
  private readonly errors = new Map<string, string>()

  constructor(
    private readonly root: string,
    private readonly onChange: (voiceId: string) => void = () => {}
  ) {}

  files(voice: Voice): VoiceFiles {
    const dir = join(this.root, voiceArchive(voice))
    if (voice.engine === 'supertonic') return { dir }
    return { dir, model: join(dir, `${voice.id}.onnx`), tokens: join(dir, 'tokens.txt'), dataDir: join(dir, 'espeak-ng-data') }
  }

  installed(voice: Voice): boolean {
    const files = this.files(voice)
    if (voice.engine === 'supertonic') return existsSync(join(files.dir, 'vocoder.int8.onnx')) && existsSync(join(files.dir, 'voice.bin'))
    return !!files.model && existsSync(files.model) && existsSync(files.tokens!)
  }

  status(voice: Voice): { installed: boolean; progress: number | null; error: string | null } {
    return { installed: this.installed(voice), progress: this.progress.get(voice.id) ?? null, error: this.errors.get(voice.id) ?? null }
  }

  // Baja e instala una voz (una sola descarga aunque se pida varias veces).
  install(voice: Voice): Promise<void> {
    const key = voiceArchive(voice)
    if (this.installed(voice)) return Promise.resolve()
    const running = this.installs.get(key)
    if (running) return running
    const job = this.download(voice).finally(() => {
      this.installs.delete(key)
      this.progress.delete(voice.id)
      this.onChange(voice.id)
    })
    this.installs.set(key, job)
    job.catch(() => undefined)
    return job
  }

  remove(voice: Voice): void {
    rmSync(this.files(voice).dir, { recursive: true, force: true })
    this.onChange(voice.id)
  }

  // Cuánto ocupan las voces bajadas.
  size(): number {
    if (!existsSync(this.root)) return 0
    const walk = (dir: string): number =>
      readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
        const path = join(dir, entry.name)
        return sum + (entry.isDirectory() ? walk(path) : statSync(path).size)
      }, 0)
    return walk(this.root)
  }

  private async download(voice: Voice): Promise<void> {
    this.errors.delete(voice.id)
    const archive = voiceArchive(voice)
    mkdirSync(this.root, { recursive: true })
    const file = join(this.root, `${archive}.tar.bz2`)
    try {
      const response = await net.fetch(`${VOICE_RELEASES}/${archive}.tar.bz2`)
      if (!response.ok || !response.body) throw new Error(`GitHub respondió ${response.status}.`)
      const total = Number(response.headers.get('Content-Length')) || 0
      let received = 0
      let reported = 0
      const counter = new Transform({
        transform: (chunk: Buffer, _encoding, done) => {
          received += chunk.length
          // Avisa el avance de a 2 % para no inundar la ventana.
          if (total > 0 && received / total - reported >= 0.02) {
            reported = received / total
            this.progress.set(voice.id, reported)
            this.onChange(voice.id)
          }
          done(null, chunk)
        }
      })
      this.progress.set(voice.id, 0)
      this.onChange(voice.id)
      await pipeline(Readable.fromWeb(response.body as never), counter, createWriteStream(file))
      await extract(file, this.root)
      if (!this.installed(voice)) throw new Error('El archivo de la voz vino incompleto.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.errors.set(voice.id, `No se pudo bajar la voz ${voice.label}: ${message}`)
      rmSync(join(this.root, archive), { recursive: true, force: true })
      throw err
    } finally {
      rmSync(file, { force: true })
    }
  }
}

// El tar de Windows (desde Windows 10) descomprime .tar.bz2.
function extract(file: string, into: string): Promise<void> {
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
  return new Promise((resolve, reject) => {
    execFile(tar, ['-xjf', file, '-C', into], { windowsHide: true, timeout: 5 * 60_000 }, (error) => (error ? reject(error) : resolve()))
  })
}

export { SUPERTONIC_ARCHIVE }
