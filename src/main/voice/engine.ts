// El motor de voz: habla con el proceso aparte que sintetiza, guarda cada frase generada en disco (la
// segunda vez suena al instante) y prepara de antemano el audio de lo que se va a escuchar.

import { utilityProcess, type UtilityProcess } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Voice } from '../../shared/voice'
import type { VoiceStore } from './store'

export class VoiceError extends Error {}

interface Pending {
  resolve: (audio: { samples: Float32Array; sampleRate: number }) => void
  reject: (error: Error) => void
}

// Hasta cuánto ocupa el audio guardado: pasado eso se borra lo más viejo.
const CACHE_LIMIT = 300 * 1024 * 1024

export class VoiceEngine {
  private worker: UtilityProcess | null = null
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  // Lo que se prepara de antemano va de a uno, sin apurar a lo que se pide para escuchar ya.
  private prefetching: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: VoiceStore,
    private readonly cacheDir: string,
    private readonly workerPath: string
  ) {
    mkdirSync(cacheDir, { recursive: true })
    this.prune()
  }

  // El audio de un texto con una voz, en WAV. Sin la voz bajada lanza VoiceError.
  async speak(voice: Voice, text: string, speed = 1): Promise<Buffer> {
    const clean = text.trim()
    if (!clean) throw new VoiceError('No hay nada para leer.')
    const file = join(this.cacheDir, `${cacheKey(voice, clean, speed)}.wav`)
    if (existsSync(file)) return readFileSync(file)
    if (!this.store.installed(voice)) throw new VoiceError(`La voz ${voice.label} todavía no está bajada.`)
    const { samples, sampleRate } = await this.generate(voice, clean, speed)
    const wav = toWav(samples, sampleRate)
    try {
      writeFileSync(file, wav)
    } catch (error) {
      console.error('[voz] No se pudo guardar el audio', error)
    }
    return wav
  }

  // Genera y guarda en segundo plano el audio de varios textos (ejemplos, diálogos, lecturas).
  prefetch(voice: Voice, texts: string[], speed = 1): void {
    if (!this.store.installed(voice)) return
    for (const text of texts) {
      this.prefetching = this.prefetching.then(() =>
        this.speak(voice, text, speed).then(
          () => undefined,
          () => undefined
        )
      )
    }
  }

  // Carga la voz en el proceso aparte (la primera frase ya no espera los ~3 s de arranque).
  warm(voice: Voice): void {
    if (!this.store.installed(voice)) return
    this.generate(voice, 'Hi.', 1).catch(() => undefined)
  }

  stop(): void {
    this.worker?.kill()
    this.worker = null
  }

  private generate(voice: Voice, text: string, speed: number): Promise<{ samples: Float32Array; sampleRate: number }> {
    const worker = this.ensureWorker()
    const files = this.store.files(voice)
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new VoiceError('La voz tardó demasiado en generar el audio.'))
      }, 60_000)
      this.pending.set(id, {
        resolve: (audio) => {
          clearTimeout(timer)
          resolve(audio)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
      worker.postMessage({
        id,
        key: `${voice.engine}:${files.dir}`,
        engine: voice.engine,
        dir: files.dir,
        model: files.model,
        tokens: files.tokens,
        dataDir: files.dataDir,
        text,
        speed,
        sid: voice.sid,
        lang: voice.lang
      })
    })
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker) return this.worker
    const worker = utilityProcess.fork(this.workerPath, [], { serviceName: 'Voz de Enhome' })
    worker.on('message', (message: { id: number; samples?: Float32Array; sampleRate?: number; error?: string }) => {
      const job = this.pending.get(message.id)
      if (!job) return
      this.pending.delete(message.id)
      if (message.error || !message.samples) job.reject(new VoiceError(message.error ?? 'La voz no devolvió audio.'))
      else job.resolve({ samples: new Float32Array(message.samples), sampleRate: message.sampleRate! })
    })
    worker.on('exit', (code) => {
      if (this.worker === worker) this.worker = null
      for (const [id, job] of this.pending) {
        this.pending.delete(id)
        job.reject(new VoiceError(`El proceso de voz se cerró (código ${code}).`))
      }
    })
    this.worker = worker
    return worker
  }

  // Borra el audio guardado más viejo cuando ocupa demasiado.
  private prune(): void {
    try {
      const files = readdirSync(this.cacheDir)
        .map((name) => {
          const path = join(this.cacheDir, name)
          const info = statSync(path)
          return { path, size: info.size, time: info.mtimeMs }
        })
        .sort((a, b) => b.time - a.time)
      let total = 0
      for (const file of files) {
        total += file.size
        if (total > CACHE_LIMIT) rmSync(file.path, { force: true })
      }
    } catch (error) {
      console.error('[voz] No se pudo ordenar el audio guardado', error)
    }
  }
}

const cacheKey = (voice: Voice, text: string, speed: number): string =>
  createHash('sha1')
    .update([voice.engine, voice.id, voice.sid ?? '', voice.lang ?? '', speed.toFixed(2), text].join('\u0000'))
    .digest('hex')

// Muestras en coma flotante a WAV de 16 bits, mono.
export function toWav(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
