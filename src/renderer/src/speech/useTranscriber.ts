import { useCallback, useEffect, useRef, useState } from 'react'
import type { LanguageId } from '@shared/languages'
import type { AsrMessage, AsrModel, AsrRequest } from './asr.worker'
import { useSettings } from '../theme/SettingsProvider'

// Nombre del idioma para Whisper.
const WHISPER_LANGUAGE: Record<LanguageId, string> = {
  en: 'english',
  pt: 'portuguese',
  it: 'italian',
  fr: 'french',
  de: 'german',
  ru: 'russian',
  ja: 'japanese',
  zh: 'chinese',
  ko: 'korean'
}
const SAMPLE_RATE = 16_000
const MAX_RECORDING_MS = 8_000

export type TranscriberState = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error'

// Un solo worker para toda la app: el modelo se carga una vez.
let shared: Worker | null = null
function worker(): Worker {
  shared ??= new Worker(new URL('./asr.worker.ts', import.meta.url), { type: 'module' })
  return shared
}

// El modelo según la compu: small con 8 núcleos o más y 8 GB de memoria; si no, base.
export function autoModel(): AsrModel {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  return navigator.hardwareConcurrency >= 8 && memory >= 8 ? 'small' : 'base'
}

// Graba del micrófono y lo transcribe con Whisper, todo en la computadora.
export function useTranscriber(language: LanguageId) {
  const { settings } = useSettings()
  const model: AsrModel = settings.asrModel === 'auto' ? autoModel() : settings.asrModel
  const [state, setState] = useState<TranscriberState>('idle')
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(new Map<number, (text: string) => void>())
  const nextId = useRef(1)
  const recorder = useRef<MediaRecorder | null>(null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const w = worker()
    const onMessage = (event: MessageEvent<AsrMessage>): void => {
      const message = event.data
      if (message.type === 'progress') setProgress({ loaded: message.loaded, total: message.total })
      else if (message.type === 'ready') setState('ready')
      else if (message.type === 'result') {
        pending.current.get(message.id)?.(message.text)
        pending.current.delete(message.id)
        setState('ready')
      } else if (message.type === 'error') {
        setError(message.message)
        setState('error')
      }
    }
    w.addEventListener('message', onMessage)
    return () => w.removeEventListener('message', onMessage)
  }, [])

  const load = useCallback(() => {
    setError(null)
    setState('loading')
    worker().postMessage({ type: 'load', model } satisfies AsrRequest)
  }, [model])

  // Graba hasta que se llama a stop (o hasta 8 segundos) y devuelve lo que entendió.
  const record = useCallback(
    async (maxMs: number = MAX_RECORDING_MS): Promise<string> => {
      setError(null)
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      } catch {
        setState('error')
        const message =
          'No se pudo usar el micrófono. Revisá que esté conectado y que Windows permita usarlo (Configuración → Privacidad → Micrófono).'
        setError(message)
        throw new Error(message)
      }
      const chunks: Blob[] = []
      const media = new MediaRecorder(stream)
      recorder.current = media
      media.ondataavailable = (e) => chunks.push(e.data)
      const stopped = new Promise<void>((resolve) => (media.onstop = () => resolve()))
      media.start()
      setState('recording')
      stopTimer.current = setTimeout(() => media.state === 'recording' && media.stop(), maxMs)
      await stopped
      clearTimeout(stopTimer.current)
      stream.getTracks().forEach((t) => t.stop())

      setState('transcribing')
      const context = new AudioContext({ sampleRate: SAMPLE_RATE })
      const decoded = await context.decodeAudioData(await new Blob(chunks).arrayBuffer())
      const audio = decoded.getChannelData(0).slice()
      await context.close()

      const id = nextId.current++
      return new Promise<string>((resolve) => {
        pending.current.set(id, resolve)
        worker().postMessage({ type: 'transcribe', id, audio, language: WHISPER_LANGUAGE[language], model } satisfies AsrRequest, [audio.buffer])
      })
    },
    [language, model]
  )

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  return { state, progress, error, load, record, stop }
}
