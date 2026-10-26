import { useCallback, useEffect, useRef, useState } from 'react'
import { VOICE_SETTING } from '@shared/settings'
import { hasVoiceFor, pickVoice, speechTag, splitForSpeech, type SpeechLang } from '@shared/speech'
import type { VoiceRole, VoiceStatus } from '@shared/voice'
import type { LanguageId } from '@shared/languages'
import { useSettings } from '../theme/SettingsProvider'

export type SpeechState = 'idle' | 'playing' | 'paused'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!supported) return
    const update = (): void => setVoices(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

// Las voces neuronales del curso (y la del español): cuáles están bajadas y cuánto falta de las que se bajan.
export function useNeuralVoices(): VoiceStatus[] {
  const [statuses, setStatuses] = useState<VoiceStatus[]>([])
  useEffect(() => {
    let alive = true
    const load = (): void => {
      window.api
        .listVoices()
        .then((list) => alive && setStatuses(list))
        .catch(() => undefined)
    }
    load()
    const off = window.api.onVoiceChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return statuses
}

interface Part {
  text: string
  lang: SpeechLang
  role: VoiceRole
  rate: number
}

// Lectura en voz alta: con la voz neural bajada del idioma (suena igual en cualquier compu) y, si
// todavía no está, con las voces de Windows. Cada parte en español o en el idioma del curso, con su voz.
export function useSpeech() {
  const voices = useVoices()
  const neural = useNeuralVoices()
  const { settings } = useSettings()
  const target = settings.language
  const [state, setState] = useState<SpeechState>('idle')
  const [rate, setRate] = useState(1)
  const generation = useRef(0)
  const audio = useRef<HTMLAudioElement | null>(null)

  const voiceFor = useCallback(
    (lang: SpeechLang) => pickVoice(voices, lang, settings[VOICE_SETTING[lang as keyof typeof VOICE_SETTING]] ?? null),
    [voices, settings]
  )
  const neuralReady = (lang: SpeechLang): boolean =>
    settings.speechEngine === 'neural' &&
    neural.some((s) => s.installed && (lang === 'es' ? s.voice.id.startsWith('es_') : !s.voice.id.startsWith('es_')))

  const stop = useCallback(() => {
    generation.current++
    if (supported) speechSynthesis.cancel()
    audio.current?.pause()
    audio.current = null
    setState('idle')
  }, [])

  // El audio neural de una parte (null si no hay voz neural para ese idioma).
  const fetchAudio = (part: Part): Promise<Uint8Array | null> =>
    settings.speechEngine === 'neural' ? window.api.speakNeural(part.text, part.lang, part.rate, part.role).catch(() => null) : Promise.resolve(null)

  // Una parte con la voz de Windows, esperando a que termine.
  const playSystem = (part: Part, run: number): Promise<void> =>
    new Promise((resolve) => {
      if (!supported || generation.current !== run) return resolve()
      const utterance = new SpeechSynthesisUtterance(part.text)
      const voice = voiceFor(part.lang)
      utterance.lang = voice?.lang ?? speechTag(part.lang)
      if (voice) utterance.voice = voice
      utterance.rate = part.rate
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      speechSynthesis.speak(utterance)
    })

  const playWav = (wav: Uint8Array, run: number): Promise<void> =>
    new Promise((resolve) => {
      if (generation.current !== run) return resolve()
      const url = URL.createObjectURL(new Blob([wav as BlobPart], { type: 'audio/wav' }))
      const element = new Audio(url)
      audio.current = element
      const done = (): void => {
        URL.revokeObjectURL(url)
        resolve()
      }
      element.onended = done
      element.onerror = done
      element.play().catch(done)
    })

  // Lee las partes en orden; mientras suena una, ya se genera la siguiente.
  const play = async (parts: Part[]): Promise<void> => {
    if (supported) speechSynthesis.cancel()
    audio.current?.pause()
    const run = ++generation.current
    if (parts.length === 0) return
    setState('playing')
    let next = fetchAudio(parts[0])
    for (let i = 0; i < parts.length; i++) {
      const wav = await next
      if (generation.current !== run) return
      if (i + 1 < parts.length) next = fetchAudio(parts[i + 1])
      if (wav) await playWav(wav, run)
      else await playSystem(parts[i], run)
    }
    if (generation.current === run) setState('idle')
  }

  const speak = useCallback(
    (text: string) => void play(splitForSpeech(text, target).map((s) => ({ text: s.text, lang: s.lang, role: 'main' as const, rate }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceFor, rate, target, settings.speechEngine]
  )

  // Lee un texto entero con la voz de un idioma, sin separarlo por partes (juegos, dictado, diálogos).
  // role «other» usa la segunda voz del idioma: el otro personaje de una conversación.
  const speakAs = useCallback(
    (text: string, lang: SpeechLang = target, slower = false, role: VoiceRole = 'main') =>
      void play([{ text, lang, role, rate: slower ? 0.75 : rate }]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceFor, rate, target, settings.speechEngine]
  )

  // Varias líneas seguidas, cada una con su voz (un diálogo a dos voces).
  const speakLines = useCallback(
    (lines: { text: string; role: VoiceRole }[], lang: SpeechLang = target) => void play(lines.map((l) => ({ ...l, lang, rate }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceFor, rate, target, settings.speechEngine]
  )

  const pause = useCallback(() => {
    if (audio.current) audio.current.pause()
    else speechSynthesis.pause()
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    if (audio.current) void audio.current.play()
    else speechSynthesis.resume()
    setState('playing')
  }, [])

  useEffect(() => stop, [stop])

  return {
    supported: (supported && voices.length > 0) || neuralReady(target),
    hasSpanish: neuralReady('es') || hasVoiceFor(voices, 'es'),
    hasTarget: neuralReady(target) || hasVoiceFor(voices, target),
    state,
    rate,
    setRate,
    speak,
    speakAs,
    speakLines,
    pause,
    resume,
    stop
  }
}

// Genera de antemano (en segundo plano) el audio de un texto, partido igual que al leerlo en voz alta:
// cuando el alumno toca «Escuchar», ya está guardado y suena al instante.
export function prefetchSpeech(text: string, target: LanguageId, lines?: { text: string; role: VoiceRole }[]): void {
  const byKey = new Map<string, { lang: SpeechLang; role: VoiceRole; texts: string[] }>()
  const add = (lang: SpeechLang, role: VoiceRole, part: string): void => {
    const key = `${lang}:${role}`
    const group = byKey.get(key) ?? { lang, role, texts: [] }
    group.texts.push(part)
    byKey.set(key, group)
  }
  for (const segment of splitForSpeech(text, target)) add(segment.lang, 'main', segment.text)
  for (const line of lines ?? []) add(target, line.role, line.text)
  for (const { lang, role, texts } of byKey.values()) window.api.prefetchVoice(texts, lang, role).catch(() => undefined)
}
