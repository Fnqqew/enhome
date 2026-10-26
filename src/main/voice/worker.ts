// Proceso aparte que genera la voz con sherpa-onnx (Piper y Supertonic), para que la ventana nunca se
// trabe mientras se sintetiza. Recibe un pedido por mensaje y devuelve las muestras del audio.

import { createRequire } from 'node:module'

interface SpeakRequest {
  id: number
  key: string
  engine: 'piper' | 'supertonic'
  dir: string
  model?: string
  tokens?: string
  dataDir?: string
  text: string
  speed: number
  sid?: number
  lang?: string
}

interface GeneratedAudio {
  samples: Float32Array
  sampleRate: number
}

interface OfflineTts {
  generate(request: unknown): GeneratedAudio
}

// sherpa-onnx-node es un módulo nativo: se carga en tiempo de ejecución, fuera del empaquetado.
// Electron no deja que un módulo nativo cree búferes «externos»: por eso cada pedido lleva enableExternalBuffer: false.
const sherpa = createRequire(__filename)('sherpa-onnx-node') as { OfflineTts: new (config: unknown) => OfflineTts }

// Las voces cargadas (cargar una tarda unos segundos); se guardan las tres últimas.
const loaded = new Map<string, OfflineTts>()
const MAX_LOADED = 3

function engineFor(request: SpeakRequest): OfflineTts {
  const cached = loaded.get(request.key)
  if (cached) {
    loaded.delete(request.key)
    loaded.set(request.key, cached)
    return cached
  }
  const d = request.dir
  const model =
    request.engine === 'supertonic'
      ? {
          supertonic: {
            durationPredictor: `${d}/duration_predictor.int8.onnx`,
            textEncoder: `${d}/text_encoder.int8.onnx`,
            vectorEstimator: `${d}/vector_estimator.int8.onnx`,
            vocoder: `${d}/vocoder.int8.onnx`,
            ttsJson: `${d}/tts.json`,
            unicodeIndexer: `${d}/unicode_indexer.bin`,
            voiceStyle: `${d}/voice.bin`
          },
          numThreads: 4,
          provider: 'cpu'
        }
      : { vits: { model: request.model, tokens: request.tokens, dataDir: request.dataDir }, numThreads: 2, provider: 'cpu' }
  const tts = new sherpa.OfflineTts({ model, maxNumSentences: 2 })
  loaded.set(request.key, tts)
  while (loaded.size > MAX_LOADED) loaded.delete(loaded.keys().next().value as string)
  return tts
}

process.parentPort.on('message', (event: { data: SpeakRequest }) => {
  const request = event.data
  try {
    const tts = engineFor(request)
    // En Supertonic el idioma va en generationConfig.extra.lang (si no, lee todo como inglés).
    const audio =
      request.engine === 'supertonic'
        ? tts.generate({
            text: request.text,
            sid: request.sid ?? 0,
            speed: request.speed,
            enableExternalBuffer: false,
            generationConfig: { sid: request.sid ?? 0, speed: request.speed, extra: { lang: request.lang ?? 'en' } }
          })
        : tts.generate({ text: request.text, sid: request.sid ?? 0, speed: request.speed, enableExternalBuffer: false })
    // El motor nativo devuelve un búfer «externo» que no se puede mandar entre procesos: se copia.
    process.parentPort.postMessage({ id: request.id, samples: new Float32Array(audio.samples), sampleRate: audio.sampleRate })
  } catch (err) {
    process.parentPort.postMessage({ id: request.id, error: err instanceof Error ? err.message : String(err) })
  }
})
