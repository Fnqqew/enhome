// Modelos de reconocimiento de voz para la práctica de pronunciación. La interfaz los pide por
// enhome-model://; la primera vez se bajan de Hugging Face y quedan en la carpeta de datos, así
// después funciona sin conexión.

import { app, net, protocol } from 'electron'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

export const MODEL_SCHEME = 'enhome-model'

// Solo se sirven los modelos que usa la app.
const ALLOWED_MODELS = ['onnx-community/whisper-base/']

const modelsDir = (): string => join(app.getPath('userData'), 'models')

// Tiene que llamarse antes de que la app esté lista.
export function registerModelScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MODEL_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
  ])
}

// enhome-model://hf/onnx-community/whisper-base/resolve/main/onnx/encoder_model_quantized.onnx
function localPath(remote: string): string | null {
  if (!ALLOWED_MODELS.some((prefix) => remote.startsWith(prefix))) return null
  const relative = normalize(remote.replace('/resolve/main/', '/'))
  if (relative.startsWith('..') || relative.includes(`..${sep}`)) return null
  return join(modelsDir(), relative)
}

// Descargas en curso, para no bajar dos veces el mismo archivo.
const downloading = new Map<string, Promise<void>>()

export function serveModels(): void {
  protocol.handle(MODEL_SCHEME, async (request) => {
    const remote = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    const file = localPath(remote)
    if (!file) return new Response('Modelo no permitido', { status: 403 })
    if (existsSync(file)) return net.fetch(pathToFileURL(file).toString())

    // Un pedido con Range solo averigua si el archivo existe y cuánto pesa: va directo, sin guardar.
    const range = request.headers.get('Range')
    if (range) return net.fetch(`https://huggingface.co/${remote}`, { headers: { Range: range } })

    const running = downloading.get(file)
    if (running) {
      await running.catch(() => undefined)
      if (existsSync(file)) return net.fetch(pathToFileURL(file).toString())
    }

    const upstream = await net.fetch(`https://huggingface.co/${remote}`)
    if (!upstream.ok || !upstream.body) return new Response(null, { status: upstream.status })

    // Se guarda mientras se entrega, así la interfaz puede mostrar el avance de la descarga.
    const [toDisk, toPage] = upstream.body.tee()
    mkdirSync(dirname(file), { recursive: true })
    const partial = `${file}.part`
    const saving = pipeline(Readable.fromWeb(toDisk as never), createWriteStream(partial))
      .then(() => renameSync(partial, file))
      .catch((error) => {
        console.error('[modelos] No se pudo guardar', remote, error)
        rmSync(partial, { force: true })
        throw error
      })
      .finally(() => downloading.delete(file))
    downloading.set(file, saving)
    saving.catch(() => undefined)
    const headers = new Headers({ 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream' })
    const length = upstream.headers.get('Content-Length')
    if (length) headers.set('Content-Length', length)
    return new Response(toPage, { status: 200, headers })
  })
}

// Para Ajustes: cuánto ocupan los modelos guardados.
export async function modelsSize(): Promise<number> {
  const walk = async (dir: string): Promise<number> => {
    if (!existsSync(dir)) return 0
    let total = 0
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      total += entry.isDirectory() ? await walk(path) : statSync(path).size
    }
    return total
  }
  return walk(modelsDir())
}

export function removeModels(): void {
  rmSync(modelsDir(), { recursive: true, force: true })
}
