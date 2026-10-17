// Reconocimiento de voz local con Whisper (transformers.js), en un worker para no trabar la interfaz.
// El modelo llega por enhome-model:// (el proceso principal lo baja una vez y lo guarda).

import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'

export const MODEL = 'onnx-community/whisper-base'

env.allowLocalModels = false
// Las direcciones siguen siendo las de Hugging Face (transformers.js solo verifica archivos por http),
// pero cada pedido pasa por enhome-model://, que los guarda en la carpeta de datos.
const HUB = 'https://huggingface.co/'
const nativeFetch = self.fetch.bind(self)
env.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return nativeFetch(url.startsWith(HUB) ? `enhome-model://hf/${url.slice(HUB.length)}` : input, init)
}) as typeof fetch
// El guardado lo hace el proceso principal, no la caché del navegador.
env.useBrowserCache = false
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href, mjs: new URL(mjsUrl, self.location.href).href }
  // Sin aislamiento entre orígenes no hay memoria compartida: un solo hilo.
  env.backends.onnx.wasm.numThreads = 1
}

export type AsrRequest = { type: 'load' } | { type: 'transcribe'; id: number; audio: Float32Array; language: string }

export type AsrMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }

let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null
const files = new Map<string, { loaded: number; total: number }>()

const post = (message: AsrMessage): void => self.postMessage(message)

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  loading ??= pipeline('automatic-speech-recognition', MODEL, {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    device: 'wasm',
    // La optimización «extendida» de ONNX choca con el decodificador cuantizado de Whisper.
    session_options: { graphOptimizationLevel: 'basic' },
    progress_callback: (info: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (info.status !== 'progress' || !info.file) return
      files.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 })
      let loaded = 0
      let total = 0
      for (const f of files.values()) {
        loaded += f.loaded
        total += f.total
      }
      post({ type: 'progress', loaded, total })
    }
  }) as Promise<AutomaticSpeechRecognitionPipeline>
  loading.catch(() => {
    loading = null
  })
  return loading
}

self.onmessage = async (event: MessageEvent<AsrRequest>) => {
  const request = event.data
  try {
    const asr = await load()
    if (request.type === 'load') {
      post({ type: 'ready' })
      return
    }
    const output = await asr(request.audio, { language: request.language, task: 'transcribe' })
    const text = Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text
    post({ type: 'result', id: request.id, text: text.trim() })
  } catch (error) {
    post({
      type: 'error',
      id: request.type === 'transcribe' ? request.id : undefined,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
